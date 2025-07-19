const axios = require('axios');
const logger = require('../utils/logger');
const BigNumber = require('bignumber.js');

/**
 * LiquidityService - Marketing Maker Strategy
 * Simula pool de liquidez própria usando provedores externos (1inch)
 * Implementa lógica de "marketing maker" onde Capy Pay otimiza spreads
 */
class LiquidityService {
  constructor() {
    this.config = {
      // Configurações 1inch
      oneInchApiKey: process.env.ONEINCH_API_KEY,
      oneInchBaseUrl: process.env.ONEINCH_BASE_URL || 'https://api.1inch.dev/swap/v6.0/8453',
      
      // Configurações de liquidez
      maxSlippage: 0.5, // 0.5%
      minLiquidityThreshold: 1000, // $1000 USD
      
      // Marketing Maker - spreads e fees
      marketMakerSpread: 0.001, // 0.1% spread para Capy Pay
      liquidityProviderFee: 0.003, // 0.3% fee para LPs externos
      protocolRevenue: 0.002, // 0.2% revenue para protocolo
      
      // Simulação de pool própria (futuro)
      ownPoolEnabled: false,
      ownPoolLiquidity: new Map(), // token -> amount
    };

    // Cache de cotações (5 segundos)
    this.priceCache = new Map();
    this.cacheTimeout = 5000;

    // Métricas de liquidez
    this.liquidityMetrics = {
      totalVolumeUSD: 0,
      totalFees: 0,
      totalSpread: 0,
      swapCount: 0,
      avgSlippage: 0,
    };

    // Simulação de liquidez própria para MVP
    this.initializeMockLiquidity();
  }

  /**
   * Inicializa liquidez mock para demonstração
   */
  initializeMockLiquidity() {
    // Simular liquidez inicial para diferentes tokens
    this.config.ownPoolLiquidity.set('USDC', new BigNumber(100000)); // $100k
    this.config.ownPoolLiquidity.set('BRZ', new BigNumber(500000));  // R$500k
    this.config.ownPoolLiquidity.set('EURC', new BigNumber(80000));  // €80k

    logger.info('Mock liquidity initialized', {
      pools: Array.from(this.config.ownPoolLiquidity.entries()).map(([token, amount]) => ({
        token,
        amount: amount.toString()
      }))
    });
  }

  /**
   * Obtém melhor taxa para swap (Marketing Maker Strategy)
   * @param {string} fromToken - Token de origem
   * @param {string} toToken - Token de destino  
   * @param {number} amount - Quantidade a trocar
   * @returns {Promise<Object>} Melhor taxa e rota
   */
  async getBestRateForSwap(fromToken, toToken, amount) {
    try {
      logger.info('Getting best rate for swap', {
        fromToken,
        toToken,
        amount,
      });

      // 1. Verificar cache de preços
      const cacheKey = `${fromToken}-${toToken}-${amount}`;
      const cachedRate = this.getCachedRate(cacheKey);
      if (cachedRate) {
        return cachedRate;
      }

      // 2. Obter cotações de múltiplas fontes
      const rates = await Promise.all([
        this.get1inchRate(fromToken, toToken, amount),
        this.getOwnPoolRate(fromToken, toToken, amount), // Simulação
        this.getCompetitorRates(fromToken, toToken, amount), // Mock
      ]);

      // 3. Aplicar Marketing Maker Strategy
      const bestRate = this.applyMarketMakerStrategy(rates, fromToken, toToken, amount);

      // 4. Cache do resultado
      this.cacheRate(cacheKey, bestRate);

      // 5. Atualizar métricas
      this.updateLiquidityMetrics(bestRate);

      logger.info('Best rate calculated', {
        fromToken,
        toToken,
        amount,
        rate: bestRate.rate,
        source: bestRate.source,
        estimatedOutput: bestRate.estimatedOutput,
      });

      return bestRate;

    } catch (error) {
      logger.error('Error getting best swap rate', {
        error: error.message,
        fromToken,
        toToken,
        amount,
      });

      throw error;
    }
  }

  /**
   * Obtém taxa da 1inch
   */
  async get1inchRate(fromToken, toToken, amount) {
    try {
      const tokenAddresses = this.getTokenAddresses();
      const fromAddress = tokenAddresses[fromToken];
      const toAddress = tokenAddresses[toToken];

      if (!fromAddress || !toAddress) {
        throw new Error(`Unsupported token pair: ${fromToken}/${toToken}`);
      }

      const amountWei = this.toWei(amount, fromToken);

      const response = await axios.get(`${this.config.oneInchBaseUrl}/quote`, {
        params: {
          src: fromAddress,
          dst: toAddress,
          amount: amountWei,
          includeProtocols: true,
          includeGas: true,
        },
        headers: {
          'Authorization': `Bearer ${this.config.oneInchApiKey}`,
        },
        timeout: 5000,
      });

      const quote = response.data;
      const outputAmount = this.fromWei(quote.dstAmount, toToken);
      const rate = outputAmount / amount;

      return {
        source: '1inch',
        rate,
        estimatedOutput: outputAmount,
        gasEstimate: quote.estimatedGas,
        protocols: quote.protocols,
        confidence: 0.95, // Alta confiança na 1inch
        slippage: this.calculateSlippage(amount, outputAmount, fromToken, toToken),
      };

    } catch (error) {
      logger.error('1inch rate fetch failed', {
        error: error.message,
        fromToken,
        toToken,
      });

      return {
        source: '1inch',
        rate: 0,
        estimatedOutput: 0,
        confidence: 0,
        error: error.message,
      };
    }
  }

  /**
   * Simula taxa da pool própria (futuro)
   */
  async getOwnPoolRate(fromToken, toToken, amount) {
    try {
      // Verificar se temos liquidez suficiente
      const fromLiquidity = this.config.ownPoolLiquidity.get(fromToken) || new BigNumber(0);
      const toLiquidity = this.config.ownPoolLiquidity.get(toToken) || new BigNumber(0);

      if (fromLiquidity.lt(amount) || toLiquidity.lt(amount)) {
        return {
          source: 'own_pool',
          rate: 0,
          estimatedOutput: 0,
          confidence: 0,
          error: 'Insufficient liquidity in own pool',
        };
      }

      // Simular AMM formula (x * y = k)
      const k = fromLiquidity.multipliedBy(toLiquidity);
      const newFromLiquidity = fromLiquidity.plus(amount);
      const newToLiquidity = k.dividedBy(newFromLiquidity);
      const outputAmount = toLiquidity.minus(newToLiquidity).toNumber();
      const rate = outputAmount / amount;

      // Aplicar spread da pool própria (menor que externos)
      const adjustedRate = rate * (1 - this.config.marketMakerSpread);
      const adjustedOutput = amount * adjustedRate;

      return {
        source: 'own_pool',
        rate: adjustedRate,
        estimatedOutput: adjustedOutput,
        confidence: 0.99, // Alta confiança na própria pool
        slippage: this.config.marketMakerSpread,
        fees: {
          protocolFee: amount * this.config.protocolRevenue,
          liquidityFee: amount * this.config.liquidityProviderFee,
        },
      };

    } catch (error) {
      logger.error('Own pool rate calculation failed', {
        error: error.message,
        fromToken,
        toToken,
      });

      return {
        source: 'own_pool',
        rate: 0,
        estimatedOutput: 0,
        confidence: 0,
        error: error.message,
      };
    }
  }

  /**
   * Simula taxas de competidores (mock)
   */
  async getCompetitorRates(fromToken, toToken, amount) {
    // Mock de outros DEXs para comparação
    const mockRates = {
      'USDC-BRZ': 5.15,
      'BRZ-USDC': 0.194,
      'EURC-BRZ': 5.45,
      'BRZ-EURC': 0.183,
      'USDC-EURC': 0.92,
      'EURC-USDC': 1.087,
    };

    const pairKey = `${fromToken}-${toToken}`;
    const baseRate = mockRates[pairKey] || 1.0;
    
    // Adicionar variação aleatória pequena
    const variance = (Math.random() - 0.5) * 0.02; // ±1%
    const rate = baseRate * (1 + variance);
    const estimatedOutput = amount * rate;

    return {
      source: 'competitor_avg',
      rate,
      estimatedOutput,
      confidence: 0.8, // Confiança média
      slippage: 0.005, // 0.5% slippage médio
    };
  }

  /**
   * Aplica estratégia de Marketing Maker
   */
  applyMarketMakerStrategy(rates, fromToken, toToken, amount) {
    // Filtrar rates válidas
    const validRates = rates.filter(rate => rate.rate > 0 && rate.confidence > 0);
    
    if (validRates.length === 0) {
      throw new Error('No valid rates available');
    }

    // Ordenar por melhor taxa (maior output)
    validRates.sort((a, b) => b.estimatedOutput - a.estimatedOutput);

    const bestExternalRate = validRates[0];
    const ownPoolRate = validRates.find(rate => rate.source === 'own_pool');

    // Marketing Maker Strategy: 
    // 1. Se nossa pool tem liquidez, usar ela com spread menor
    // 2. Senão, usar melhor externa + nosso spread
    // 3. Sempre garantir melhor preço para usuário

    let finalRate;

    if (ownPoolRate && ownPoolRate.confidence > 0) {
      // Usar pool própria se disponível e competitiva
      if (ownPoolRate.estimatedOutput >= bestExternalRate.estimatedOutput * 0.995) {
        finalRate = {
          ...ownPoolRate,
          strategy: 'own_pool_competitive',
          savings: ownPoolRate.estimatedOutput - bestExternalRate.estimatedOutput,
        };
      } else {
        // Pool própria não competitiva, usar externa
        finalRate = this.enhanceExternalRate(bestExternalRate, amount);
      }
    } else {
      // Usar melhor taxa externa com nossos enhancements
      finalRate = this.enhanceExternalRate(bestExternalRate, amount);
    }

    // Adicionar informações de Marketing Maker
    finalRate.marketMaker = {
      capyPaySpread: this.config.marketMakerSpread,
      estimatedRevenue: amount * this.config.protocolRevenue,
      userSavings: this.calculateUserSavings(finalRate, validRates),
      liquiditySource: finalRate.source,
    };

    return finalRate;
  }

  /**
   * Melhora taxa externa com estratégia própria
   */
  enhanceExternalRate(externalRate, amount) {
    // Aplicar pequeno spread para Capy Pay mantendo competitividade
    const enhancedOutput = externalRate.estimatedOutput * (1 - this.config.marketMakerSpread);
    const enhancedRate = enhancedOutput / amount;

    return {
      ...externalRate,
      rate: enhancedRate,
      estimatedOutput: enhancedOutput,
      strategy: 'external_enhanced',
      originalOutput: externalRate.estimatedOutput,
      capyPayFee: externalRate.estimatedOutput - enhancedOutput,
    };
  }

  /**
   * Provisão de liquidez (placeholder para futuro)
   * @param {string} token - Token a ser provisionado
   * @param {number} amount - Quantidade
   * @param {string} providerId - ID do provedor de liquidez
   */
  async provideLiquidity(token, amount, providerId) {
    try {
      logger.info('Liquidity provision request', {
        token,
        amount,
        providerId,
      });

      // Para MVP, apenas simular
      const currentLiquidity = this.config.ownPoolLiquidity.get(token) || new BigNumber(0);
      const newLiquidity = currentLiquidity.plus(amount);
      
      this.config.ownPoolLiquidity.set(token, newLiquidity);

      // Calcular LP tokens (simulação)
      const lpTokens = this.calculateLPTokens(token, amount);

      logger.info('Liquidity provided successfully', {
        token,
        amount,
        providerId,
        newTotalLiquidity: newLiquidity.toString(),
        lpTokensIssued: lpTokens,
      });

      return {
        success: true,
        lpTokens,
        newTotalLiquidity: newLiquidity.toString(),
        apr: this.calculateAPR(token), // Simulação
        data: {
          transactionId: `lp_${Date.now()}`,
          token,
          amount,
          providerId,
          timestamp: new Date(),
        },
      };

    } catch (error) {
      logger.error('Liquidity provision failed', {
        error: error.message,
        token,
        amount,
        providerId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Remove liquidez (placeholder)
   */
  async removeLiquidity(token, lpTokens, providerId) {
    try {
      // Calcular quantidade a ser removida
      const totalLiquidity = this.config.ownPoolLiquidity.get(token) || new BigNumber(0);
      const totalLPTokens = this.getTotalLPTokens(token);
      const removeAmount = totalLiquidity.multipliedBy(lpTokens).dividedBy(totalLPTokens);

      // Atualizar liquidez
      const newLiquidity = totalLiquidity.minus(removeAmount);
      this.config.ownPoolLiquidity.set(token, newLiquidity);

      logger.info('Liquidity removed successfully', {
        token,
        lpTokens,
        removeAmount: removeAmount.toString(),
        newTotalLiquidity: newLiquidity.toString(),
      });

      return {
        success: true,
        removedAmount: removeAmount.toString(),
        newTotalLiquidity: newLiquidity.toString(),
      };

    } catch (error) {
      logger.error('Liquidity removal failed', {
        error: error.message,
        token,
        lpTokens,
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
  getCachedRate(cacheKey) {
    const cached = this.priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  cacheRate(cacheKey, rateData) {
    this.priceCache.set(cacheKey, {
      data: rateData,
      timestamp: Date.now(),
    });
  }

  getTokenAddresses() {
    return {
      'USDC': process.env.USDC_BASE_CONTRACT,
      'BRZ': process.env.BRZ_BASE_CONTRACT,
      'EURC': process.env.EURC_BASE_CONTRACT,
    };
  }

  toWei(amount, token) {
    const decimals = this.getTokenDecimals(token);
    return new BigNumber(amount).multipliedBy(new BigNumber(10).pow(decimals)).toFixed(0);
  }

  fromWei(amountWei, token) {
    const decimals = this.getTokenDecimals(token);
    return new BigNumber(amountWei).dividedBy(new BigNumber(10).pow(decimals)).toNumber();
  }

  getTokenDecimals(token) {
    const decimals = {
      'USDC': 6,
      'BRZ': 4,
      'EURC': 6,
    };
    return decimals[token] || 18;
  }

  calculateSlippage(inputAmount, outputAmount, fromToken, toToken) {
    // Calcular slippage baseado em preço esperado vs real
    const expectedRate = this.getExpectedRate(fromToken, toToken);
    const actualRate = outputAmount / inputAmount;
    return Math.abs((expectedRate - actualRate) / expectedRate);
  }

  getExpectedRate(fromToken, toToken) {
    // Mock de taxas esperadas
    const expectedRates = {
      'USDC-BRZ': 5.2,
      'BRZ-USDC': 0.192,
      'EURC-BRZ': 5.5,
      'BRZ-EURC': 0.182,
    };
    return expectedRates[`${fromToken}-${toToken}`] || 1.0;
  }

  calculateUserSavings(finalRate, allRates) {
    const worstRate = Math.min(...allRates.map(r => r.estimatedOutput));
    return finalRate.estimatedOutput - worstRate;
  }

  calculateLPTokens(token, amount) {
    // Fórmula simplificada para LP tokens
    const totalLiquidity = this.config.ownPoolLiquidity.get(token) || new BigNumber(1);
    const totalLPTokens = this.getTotalLPTokens(token);
    return (amount / totalLiquidity.toNumber()) * totalLPTokens;
  }

  getTotalLPTokens(token) {
    // Mock de total LP tokens
    return 1000000; // 1M LP tokens
  }

  calculateAPR(token) {
    // Mock APR baseado em volume e fees
    const baseAPR = 0.12; // 12% base
    const volumeBonus = Math.random() * 0.05; // até 5% bonus
    return baseAPR + volumeBonus;
  }

  updateLiquidityMetrics(rateData) {
    this.liquidityMetrics.swapCount += 1;
    this.liquidityMetrics.totalVolumeUSD += rateData.estimatedOutput || 0;
    this.liquidityMetrics.totalFees += rateData.marketMaker?.capyPayFee || 0;
    this.liquidityMetrics.totalSpread += rateData.marketMaker?.capyPaySpread || 0;
    
    // Calcular slippage médio
    if (rateData.slippage) {
      this.liquidityMetrics.avgSlippage = 
        (this.liquidityMetrics.avgSlippage * (this.liquidityMetrics.swapCount - 1) + rateData.slippage) / 
        this.liquidityMetrics.swapCount;
    }
  }

  /**
   * Obtém métricas de liquidez
   */
  getLiquidityMetrics() {
    return {
      ...this.liquidityMetrics,
      ownPoolLiquidity: Array.from(this.config.ownPoolLiquidity.entries()).map(([token, amount]) => ({
        token,
        amount: amount.toString(),
        usdValue: this.getUSDValue(token, amount.toNumber()),
      })),
      totalLiquidityUSD: this.getTotalLiquidityUSD(),
      timestamp: new Date(),
    };
  }

  getUSDValue(token, amount) {
    // Mock de conversão para USD
    const usdRates = {
      'USDC': 1.0,
      'BRZ': 0.19,
      'EURC': 1.08,
    };
    return amount * (usdRates[token] || 1.0);
  }

  getTotalLiquidityUSD() {
    let total = 0;
    for (const [token, amount] of this.config.ownPoolLiquidity.entries()) {
      total += this.getUSDValue(token, amount.toNumber());
    }
    return total;
  }
}

module.exports = LiquidityService; 