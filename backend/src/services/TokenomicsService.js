const logger = require('../utils/logger');
const LiquidityService = require('./LiquidityService');
const RewardsService = require('./RewardsService');
const BRcapyService = require('./BRcapyService');

/**
 * TokenomicsService - Integração Central de Tokenomics
 * Coordena LiquidityService, RewardsService e BRcapyService
 * Interface única para o CoreService interagir com tokenomics
 */
class TokenomicsService {
  constructor() {
    // Inicializar serviços
    this.liquidityService = new LiquidityService();
    this.rewardsService = new RewardsService();
    this.brcapyService = new BRcapyService();

    // Configurações de integração
    this.config = {
      // Thresholds para auto-conversões
      autoRewardThreshold: 100, // $100 USD para trigger rewards
      autoCapyCoinsThreshold: 1000, // $1000 USD para CAPY coins
      autoBRcapyThreshold: 50, // $50 USD para BRcapy yield

      // Multiplicadores baseados em holdings
      capyCoinsMultiplier: {
        0: 1.0,    // Sem CAPY coins
        10: 1.1,   // 10% bonus com 10+ CAPY
        50: 1.15,  // 15% bonus com 50+ CAPY
        100: 1.2,  // 20% bonus com 100+ CAPY
        500: 1.25, // 25% bonus com 500+ CAPY
      },

      // BRcapy auto-investment
      brcapyAutoInvestEnabled: true,
      brcapyAutoInvestPercentage: 0.1, // 10% das stablecoins para BRcapy
    };

    logger.info('TokenomicsService initialized', {
      liquidityEnabled: !!this.liquidityService,
      rewardsEnabled: !!this.rewardsService,
      brcapyEnabled: !!this.brcapyService,
    });
  }

  /**
   * Processa recompensas após transação bem-sucedida
   * Chamado pelo CoreService após swaps/pagamentos
   * @param {Object} transactionData - Dados da transação
   * @returns {Promise<Object>} Resultado do processamento
   */
  async processTransactionRewards(transactionData) {
    try {
      const { userId, type, amount, fromToken, toToken, success } = transactionData;

      if (!success) {
        logger.info('Skipping rewards for failed transaction', { 
          transactionId: transactionData.id 
        });
        return { success: true, rewards: null };
      }

      logger.info('Processing transaction rewards', {
        userId,
        type,
        amount,
        fromToken,
        toToken,
      });

      const rewards = {
        capyPoints: null,
        capyCoins: null,
        brcapyYield: null,
        discountApplied: null,
      };

      // 1. Calcular valor USD da transação
      const usdValue = await this.calculateUSDValue(amount, fromToken || 'BRL');

      // 2. Distribuir Capy Points
      if (usdValue >= 1) { // Mínimo $1 USD
        const activityType = this.mapTransactionTypeToActivity(type);
        rewards.capyPoints = await this.rewardsService.awardCapyPoints(
          userId, 
          activityType, 
          usdValue
        );
      }

      // 3. Distribuir Capy Coins (para transações maiores)
      if (usdValue >= this.config.autoCapyCoinsThreshold) {
        const coinsToAward = Math.floor(usdValue / 100) * 0.1; // 0.1 CAPY per $100
        rewards.capyCoins = await this.rewardsService.distributeCapyCoins(
          userId,
          coinsToAward,
          'reward'
        );
      }

      // 4. Auto-investimento em BRcapy (se habilitado)
      if (this.config.brcapyAutoInvestEnabled && 
          this.shouldAutoInvestInBRcapy(transactionData)) {
        rewards.brcapyYield = await this.processAutoInvestment(userId, transactionData);
      }

      // 5. Aplicar multiplicadores baseados em holdings
      rewards.multipliers = await this.calculateHoldingMultipliers(userId);

      logger.info('Transaction rewards processed successfully', {
        userId,
        transactionId: transactionData.id,
        usdValue,
        pointsAwarded: rewards.capyPoints?.pointsAwarded || 0,
        coinsAwarded: rewards.capyCoins?.coinsDistributed || 0,
        brcapyInvested: rewards.brcapyYield?.minted?.brlAmount || 0,
      });

      return {
        success: true,
        rewards,
        summary: {
          usdValue,
          pointsAwarded: rewards.capyPoints?.pointsAwarded || 0,
          coinsAwarded: rewards.capyCoins?.coinsDistributed || 0,
          brcapyInvested: rewards.brcapyYield?.minted?.brlAmount || 0,
          multipliers: rewards.multipliers,
        },
      };

    } catch (error) {
      logger.error('Failed to process transaction rewards', {
        error: error.message,
        transactionData,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Calcula desconto total considerando todas as fontes
   * @param {string} userId - ID do usuário
   * @param {number} feeAmount - Taxa original
   * @returns {Promise<Object>} Desconto calculado
   */
  async calculateTotalDiscount(userId, feeAmount) {
    try {
      // 1. Desconto base por Capy Coins
      const capyCoinsDiscount = await this.rewardsService.applyDiscount(userId, feeAmount);

      // 2. Desconto adicional por BRcapy holdings
      const brcapyDiscount = await this.calculateBRcapyDiscount(userId, feeAmount);

      // 3. Desconto por streak de uso
      const streakDiscount = await this.calculateStreakDiscount(userId, feeAmount);

      // 4. Combinar descontos (não cumulativo simples, usar fórmula composta)
      const totalDiscountPercent = this.combineDiscounts([
        capyCoinsDiscount.discountPercent,
        brcapyDiscount.discountPercent,
        streakDiscount.discountPercent,
      ]);

      const totalDiscountAmount = feeAmount * totalDiscountPercent;
      const finalFee = feeAmount - totalDiscountAmount;

      return {
        success: true,
        originalFee: feeAmount,
        finalFee,
        totalDiscountPercent,
        totalDiscountAmount,
        breakdown: {
          capyCoins: capyCoinsDiscount,
          brcapy: brcapyDiscount,
          streak: streakDiscount,
        },
        savings: totalDiscountAmount,
      };

    } catch (error) {
      logger.error('Failed to calculate total discount', {
        error: error.message,
        userId,
        feeAmount,
      });

      return {
        success: false,
        originalFee: feeAmount,
        finalFee: feeAmount,
        error: error.message,
      };
    }
  }

  /**
   * Obtém melhor taxa de swap considerando liquidez e incentivos
   * @param {string} fromToken - Token origem
   * @param {string} toToken - Token destino
   * @param {number} amount - Quantidade
   * @param {string} userId - ID do usuário (para incentivos)
   * @returns {Promise<Object>} Melhor taxa com incentivos
   */
  async getBestSwapRate(fromToken, toToken, amount, userId = null) {
    try {
      // 1. Obter melhor taxa da LiquidityService
      const baseRate = await this.liquidityService.getBestRateForSwap(
        fromToken, 
        toToken, 
        amount
      );

      if (!baseRate || !baseRate.rate) {
        throw new Error('No valid swap rate available');
      }

      // 2. Aplicar incentivos se usuário fornecido
      let enhancedRate = { ...baseRate };
      
      if (userId) {
        // Calcular multiplicadores por holdings
        const multipliers = await this.calculateHoldingMultipliers(userId);
        
        // Aplicar bonus na taxa (melhor output para o usuário)
        const totalMultiplier = multipliers.total;
        enhancedRate.estimatedOutput *= totalMultiplier;
        enhancedRate.rate *= totalMultiplier;
        
        enhancedRate.incentives = {
          multipliers,
          bonusOutput: enhancedRate.estimatedOutput - baseRate.estimatedOutput,
          bonusPercent: (totalMultiplier - 1) * 100,
        };

        // Calcular desconto na taxa
        const feeDiscount = await this.calculateTotalDiscount(
          userId, 
          baseRate.marketMaker?.capyPayFee || 0
        );
        
        enhancedRate.feeDiscount = feeDiscount;
      }

      return {
        success: true,
        rate: enhancedRate,
      };

    } catch (error) {
      logger.error('Failed to get best swap rate', {
        error: error.message,
        fromToken,
        toToken,
        amount,
        userId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Processa auto-investimento em BRcapy
   */
  async processAutoInvestment(userId, transactionData) {
    try {
      const { amount, toToken } = transactionData;
      
      // Apenas para stablecoins que chegam ao usuário
      if (!['BRZ', 'USDC', 'EURC'].includes(toToken)) {
        return null;
      }

      // Calcular valor BRL para investimento
      const brlValue = await this.calculateBRLValue(amount, toToken);
      const investmentAmount = brlValue * this.config.brcapyAutoInvestPercentage;

      // Mínimo de R$10 para investir
      if (investmentAmount < 10) {
        return null;
      }

      logger.info('Processing auto-investment in BRcapy', {
        userId,
        originalAmount: amount,
        token: toToken,
        brlValue,
        investmentAmount,
      });

      const mintResult = await this.brcapyService.mintBRcapy(userId, investmentAmount);

      if (mintResult.success) {
        logger.info('Auto-investment in BRcapy completed', {
          userId,
          investmentAmount,
          brcapyMinted: mintResult.minted.brcapyAmount,
        });
      }

      return mintResult;

    } catch (error) {
      logger.error('Auto-investment in BRcapy failed', {
        error: error.message,
        userId,
        transactionData,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtém dashboard completo de tokenomics do usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} Dashboard completo
   */
  async getUserTokenomicsDashboard(userId) {
    try {
      // Obter dados de todos os serviços
      const [rewardsProfile, brcapyPosition, liquidityStats] = await Promise.all([
        this.rewardsService.getUserRewardsProfile(userId),
        this.brcapyService.getUserPosition(userId),
        this.getLiquidityParticipation(userId),
      ]);

      // Calcular métricas agregadas
      const totalPortfolioValue = this.calculateTotalPortfolioValue({
        capyCoins: rewardsProfile.profile?.balances.capyCoins || 0,
        brcapy: brcapyPosition.position?.balance.brl || 0,
      });

      const projectedYield = this.calculateProjectedYield({
        brcapy: brcapyPosition.position?.projections || {},
      });

      return {
        success: true,
        dashboard: {
          userId,
          
          // Balances
          balances: {
            capyPoints: rewardsProfile.profile?.balances.capyPoints || 0,
            capyCoins: rewardsProfile.profile?.balances.capyCoins || 0,
            brcapy: brcapyPosition.position?.balance.brcapy || 0,
            brcapyValueBRL: brcapyPosition.position?.balance.brl || 0,
          },

          // Performance
          performance: {
            totalPortfolioValue,
            brcapyPerformance: brcapyPosition.position?.performance || {},
            rewardsEarned: rewardsProfile.profile?.statistics || {},
          },

          // Discounts & Benefits
          benefits: {
            discountTier: rewardsProfile.profile?.discounts.currentTier || {},
            nextTier: rewardsProfile.profile?.discounts.nextTier || null,
            progressToNext: rewardsProfile.profile?.discounts.progressToNext || null,
          },

          // Projections
          projections: {
            yield: projectedYield,
            rewards: this.calculateRewardsProjection(userId),
          },

          // Activity
          recentActivity: [
            ...(rewardsProfile.profile?.recentActivity || []),
            ...(brcapyPosition.position?.history || []).slice(-5),
          ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10),

          timestamp: new Date(),
        },
      };

    } catch (error) {
      logger.error('Failed to get user tokenomics dashboard', {
        error: error.message,
        userId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Métodos auxiliares
   */
  async calculateUSDValue(amount, token) {
    const usdRates = {
      'BRL': 0.19,
      'USDC': 1.0,
      'EURC': 1.08,
      'BRZ': 0.19,
    };
    
    return amount * (usdRates[token] || 1.0);
  }

  async calculateBRLValue(amount, token) {
    const brlRates = {
      'BRL': 1.0,
      'USDC': 5.2,
      'EURC': 5.6,
      'BRZ': 1.0,
    };
    
    return amount * (brlRates[token] || 1.0);
  }

  mapTransactionTypeToActivity(transactionType) {
    const mapping = {
      'BOLETO_PAYMENT': 'bill_payment',
      'CRYPTO_FIAT_EXCHANGE': 'swap',
      'SWAP': 'swap',
      'TRANSFER': 'swap',
    };
    
    return mapping[transactionType] || 'swap';
  }

  shouldAutoInvestInBRcapy(transactionData) {
    const { type, amount, toToken } = transactionData;
    
    // Apenas para exchanges que resultam em stablecoins
    if (type !== 'CRYPTO_FIAT_EXCHANGE') return false;
    if (!['BRZ', 'USDC', 'EURC'].includes(toToken)) return false;
    
    // Valor mínimo
    const brlValue = this.calculateBRLValue(amount, toToken);
    return brlValue >= this.config.autoBRcapyThreshold;
  }

  async calculateHoldingMultipliers(userId) {
    const capyCoins = (await this.rewardsService.getUserRewardsProfile(userId))
      .profile?.balances.capyCoins || 0;
    
    const brcapy = (await this.brcapyService.getUserPosition(userId))
      .position?.balance.brcapy || 0;

    // Multiplicador por Capy Coins
    let capyMultiplier = 1.0;
    for (const [threshold, multiplier] of Object.entries(this.config.capyCoinsMultiplier)) {
      if (capyCoins >= parseInt(threshold)) {
        capyMultiplier = multiplier;
      }
    }

    // Multiplicador por BRcapy (menor, mas adicional)
    const brcapyMultiplier = Math.min(1.1, 1 + (brcapy / 10000) * 0.05); // Max 10% bonus

    // Multiplicador total (não linear)
    const totalMultiplier = capyMultiplier * brcapyMultiplier;

    return {
      capyCoins: capyMultiplier,
      brcapy: brcapyMultiplier,
      total: totalMultiplier,
      breakdown: {
        capyCoinsBalance: capyCoins,
        brcapyBalance: brcapy,
      },
    };
  }

  async calculateBRcapyDiscount(userId, feeAmount) {
    const position = await this.brcapyService.getUserPosition(userId);
    const brcapyBalance = position.position?.balance.brcapy || 0;
    
    // Desconto baseado em BRcapy holdings (máximo 5%)
    const maxDiscount = 0.05;
    const discountPercent = Math.min(maxDiscount, brcapyBalance / 10000 * 0.01);
    const discountAmount = feeAmount * discountPercent;

    return {
      discountPercent,
      discountAmount,
      source: 'brcapy_holdings',
      brcapyBalance,
    };
  }

  async calculateStreakDiscount(userId, feeAmount) {
    const profile = await this.rewardsService.getUserRewardsProfile(userId);
    const streak = profile.profile?.balances.dailyStreak || 0;
    
    // Desconto baseado em streak (máximo 3%)
    const maxDiscount = 0.03;
    const discountPercent = Math.min(maxDiscount, streak / 30 * maxDiscount);
    const discountAmount = feeAmount * discountPercent;

    return {
      discountPercent,
      discountAmount,
      source: 'daily_streak',
      streakDays: streak,
    };
  }

  combineDiscounts(discountPercentages) {
    // Usar fórmula composta: 1 - (1-d1)(1-d2)(1-d3)
    let combined = 1;
    for (const discount of discountPercentages) {
      combined *= (1 - discount);
    }
    return Math.min(0.3, 1 - combined); // Máximo 30% desconto total
  }

  calculateTotalPortfolioValue(balances) {
    // Valores mock em USD
    const capyCoinsPrice = 2.5; // $2.50 per CAPY
    const brcapyValueUSD = balances.brcapy * 0.19; // BRL to USD

    return (balances.capyCoins * capyCoinsPrice) + brcapyValueUSD;
  }

  calculateProjectedYield(data) {
    return {
      daily: data.brcapy?.daily || 0,
      monthly: data.brcapy?.monthly || 0,
      annual: data.brcapy?.annual || 0,
    };
  }

  calculateRewardsProjection(userId) {
    // Projeção baseada em atividade histórica
    return {
      pointsPerMonth: 500, // Mock
      coinsPerMonth: 2.5,  // Mock
    };
  }

  async getLiquidityParticipation(userId) {
    // Placeholder para participação em liquidez
    return {
      provided: 0,
      earned: 0,
      apr: 0,
    };
  }

  /**
   * Obtém estatísticas globais de tokenomics
   */
  async getGlobalTokenomicsStats() {
    const [rewardsStats, brcapyStats, liquidityStats] = await Promise.all([
      this.rewardsService.getGlobalRewardsStats(),
      this.brcapyService.getBRcapyStats(),
      this.liquidityService.getLiquidityMetrics(),
    ]);

    return {
      rewards: rewardsStats,
      brcapy: brcapyStats,
      liquidity: liquidityStats,
      combined: {
        totalUsers: Math.max(rewardsStats.totalUsers, brcapyStats.users.totalHolders),
        totalValueLocked: brcapyStats.pool.totalValueLocked + liquidityStats.totalLiquidityUSD,
        totalRewardsDistributed: rewardsStats.totalPointsIssued + rewardsStats.totalCoinsIssued,
      },
      timestamp: new Date(),
    };
  }
}

module.exports = TokenomicsService; 