const BigNumber = require('bignumber.js');
const winston = require('winston');

/**
 * RewardsService - Gerencia recompensas, pontos e tokens do Capy Pay
 * 
 * Funcionalidades:
 * - Capy Points (pontos internos)
 * - Capy Coins (ERC-20 token)
 * - Sistema de descontos progressivos
 * - Recompensas por referência
 * - Integração com notificações
 */
class RewardsService {
    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/rewards.log' }),
                new winston.transports.Console()
            ]
        });

        // Configurações de recompensas
        this.config = {
            // Taxas de conversão
            pointsToCoinsRate: 100, // 100 pontos = 1 Capy Coin
            
            // Multiplicadores por transação
            swapPointsMultiplier: 1.0,
            paymentPointsMultiplier: 2.0,
            referralPointsMultiplier: 5.0,
            
            // Recompensas de referência
            referralBonusCoins: 50,        // Bonus para indicador
            welcomeBonusCoins: 25,         // Bonus para indicado
            referralFeePercentage: 0.10,   // 10% das taxas para indicador
            
            // Limites de desconto
            maxDiscountPercentage: 0.15,   // 15% máximo
            
            // Tiers de desconto baseados em Capy Coins
            discountTiers: [
                { minCoins: 0, discount: 0.00 },      // 0%
                { minCoins: 100, discount: 0.02 },    // 2%
                { minCoins: 500, discount: 0.05 },    // 5%
                { minCoins: 1000, discount: 0.08 },   // 8%
                { minCoins: 2500, discount: 0.12 },   // 12%
                { minCoins: 5000, discount: 0.15 }    // 15%
            ]
        };

        // Storage em memória para MVP - substituir por banco de dados
        this.userBalances = new Map(); // userId -> { points, coins, lastUpdated }
        this.transactionHistory = new Map(); // userId -> Array<{ type, amount, timestamp, details }>
        this.referralRewards = new Map(); // userId -> { totalEarned, totalReferrals, lastReward }

        this.logger.info('RewardsService initialized with referral integration');
    }

    /**
     * Processa recompensas após uma transação
     * @param {string} userId - ID do usuário
     * @param {string} transactionType - Tipo da transação (swap, payment, referral)
     * @param {number} transactionAmount - Valor da transação
     * @param {number} feeAmount - Taxa cobrada
     * @param {Object} metadata - Metadados adicionais
     * @returns {Promise<Object>} - Resultado do processamento
     */
    async processTransactionRewards(userId, transactionType, transactionAmount, feeAmount, metadata = {}) {
        try {
            // Calcular pontos baseados na taxa
            const basePoints = Math.floor(feeAmount * 10); // 10 pontos por dólar de taxa
            
            // Aplicar multiplicador baseado no tipo de transação
            let multiplier = 1.0;
            switch (transactionType) {
                case 'swap':
                    multiplier = this.config.swapPointsMultiplier;
                    break;
                case 'payment':
                    multiplier = this.config.paymentPointsMultiplier;
                    break;
                case 'referral':
                    multiplier = this.config.referralPointsMultiplier;
                    break;
            }

            const finalPoints = Math.floor(basePoints * multiplier);

            // Conceder pontos
            const pointsResult = await this.awardCapyPoints(userId, finalPoints, {
                type: transactionType,
                transactionAmount,
                feeAmount,
                ...metadata
            });

            if (!pointsResult.success) {
                return pointsResult;
            }

            // Registrar no histórico
            this.addTransactionHistory(userId, {
                type: 'points_earned',
                amount: finalPoints,
                timestamp: new Date().toISOString(),
                details: {
                    transactionType,
                    transactionAmount,
                    feeAmount,
                    multiplier
                }
            });

            this.logger.info(`Transaction rewards processed`, {
                userId,
                transactionType,
                pointsAwarded: finalPoints,
                multiplier
            });

            return {
                success: true,
                pointsAwarded: finalPoints,
                multiplier,
                newBalance: pointsResult.newBalance
            };

        } catch (error) {
            this.logger.error('Error processing transaction rewards', {
                userId,
                transactionType,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to process transaction rewards'
            };
        }
    }

    /**
     * Concede recompensa de referência para o indicador
     * @param {string} referrerId - ID do indicador
     * @param {string} referredUserId - ID do indicado
     * @param {string} transactionId - ID da transação que gerou a recompensa
     * @param {number} feeAmount - Valor da taxa da transação
     * @returns {Promise<Object>} - Resultado da concessão
     */
    async awardReferralReward(referrerId, referredUserId, transactionId, feeAmount) {
        try {
            // Calcular recompensa baseada na taxa
            const rewardAmount = feeAmount * this.config.referralFeePercentage;
            const coinsToAward = Math.floor(rewardAmount * 10); // 10 coins por dólar

            // Conceder Capy Coins para o indicador
            const coinsResult = await this.awardCapyCoins(referrerId, coinsToAward, {
                type: 'referral_reward',
                referredUserId,
                transactionId,
                feeAmount,
                rewardPercentage: this.config.referralFeePercentage
            });

            if (!coinsResult.success) {
                return coinsResult;
            }

            // Atualizar estatísticas de referência
            this.updateReferralStats(referrerId, coinsToAward);

            // Registrar no histórico
            this.addTransactionHistory(referrerId, {
                type: 'referral_reward',
                amount: coinsToAward,
                timestamp: new Date().toISOString(),
                details: {
                    referredUserId,
                    transactionId,
                    feeAmount,
                    rewardPercentage: this.config.referralFeePercentage
                }
            });

            this.logger.info(`Referral reward awarded`, {
                referrerId,
                referredUserId,
                transactionId,
                coinsAwarded: coinsToAward,
                feeAmount
            });

            return {
                success: true,
                coinsAwarded: coinsToAward,
                referrerId,
                referredUserId,
                transactionId
            };

        } catch (error) {
            this.logger.error('Error awarding referral reward', {
                referrerId,
                referredUserId,
                transactionId,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to award referral reward'
            };
        }
    }

    /**
     * Processa bônus de boas-vindas para novo usuário indicado
     * @param {string} userId - ID do novo usuário
     * @param {string} referrerId - ID do indicador
     * @returns {Promise<Object>} - Resultado do processamento
     */
    async processWelcomeBonus(userId, referrerId) {
        try {
            // Conceder bônus de boas-vindas
            const welcomeResult = await this.awardCapyCoins(userId, this.config.welcomeBonusCoins, {
                type: 'welcome_bonus',
                referrerId
            });

            if (!welcomeResult.success) {
                return welcomeResult;
            }

            // Conceder bônus de indicação para o indicador
            const referralResult = await this.awardCapyCoins(referrerId, this.config.referralBonusCoins, {
                type: 'referral_bonus',
                referredUserId: userId
            });

            // Registrar no histórico de ambos
            this.addTransactionHistory(userId, {
                type: 'welcome_bonus',
                amount: this.config.welcomeBonusCoins,
                timestamp: new Date().toISOString(),
                details: { referrerId }
            });

            if (referralResult.success) {
                this.addTransactionHistory(referrerId, {
                    type: 'referral_bonus',
                    amount: this.config.referralBonusCoins,
                    timestamp: new Date().toISOString(),
                    details: { referredUserId: userId }
                });
            }

            this.logger.info(`Welcome bonus processed`, {
                userId,
                referrerId,
                welcomeBonus: this.config.welcomeBonusCoins,
                referralBonus: this.config.referralBonusCoins
            });

            return {
                success: true,
                welcomeBonus: this.config.welcomeBonusCoins,
                referralBonus: referralResult.success ? this.config.referralBonusCoins : 0,
                newUserBalance: welcomeResult.newBalance,
                referrerBalance: referralResult.success ? referralResult.newBalance : null
            };

        } catch (error) {
            this.logger.error('Error processing welcome bonus', {
                userId,
                referrerId,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to process welcome bonus'
            };
        }
    }

    /**
     * Concede Capy Points para um usuário
     * @param {string} userId - ID do usuário
     * @param {number} points - Pontos a conceder
     * @param {Object} metadata - Metadados da transação
     * @returns {Promise<Object>} - Resultado da concessão
     */
    async awardCapyPoints(userId, points, metadata = {}) {
        try {
            if (points <= 0) {
                return {
                    success: false,
                    error: 'Points amount must be positive'
                };
            }

            // Obter saldo atual
            let balance = this.userBalances.get(userId) || {
                points: 0,
                coins: 0,
                lastUpdated: new Date().toISOString()
            };

            // Adicionar pontos
            balance.points += points;
            balance.lastUpdated = new Date().toISOString();

            // Salvar saldo atualizado
            this.userBalances.set(userId, balance);

            this.logger.info(`Capy Points awarded`, {
                userId,
                pointsAwarded: points,
                newBalance: balance.points,
                metadata
            });

            return {
                success: true,
                pointsAwarded: points,
                newBalance: balance.points,
                totalCoins: balance.coins
            };

        } catch (error) {
            this.logger.error('Error awarding Capy Points', {
                userId,
                points,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to award Capy Points'
            };
        }
    }

    /**
     * Concede Capy Coins para um usuário
     * @param {string} userId - ID do usuário
     * @param {number} coins - Coins a conceder
     * @param {Object} metadata - Metadados da transação
     * @returns {Promise<Object>} - Resultado da concessão
     */
    async awardCapyCoins(userId, coins, metadata = {}) {
        try {
            if (coins <= 0) {
                return {
                    success: false,
                    error: 'Coins amount must be positive'
                };
            }

            // Obter saldo atual
            let balance = this.userBalances.get(userId) || {
                points: 0,
                coins: 0,
                lastUpdated: new Date().toISOString()
            };

            // Adicionar coins
            balance.coins += coins;
            balance.lastUpdated = new Date().toISOString();

            // Salvar saldo atualizado
            this.userBalances.set(userId, balance);

            this.logger.info(`Capy Coins awarded`, {
                userId,
                coinsAwarded: coins,
                newBalance: balance.coins,
                metadata
            });

            return {
                success: true,
                coinsAwarded: coins,
                newBalance: balance.coins,
                totalPoints: balance.points
            };

        } catch (error) {
            this.logger.error('Error awarding Capy Coins', {
                userId,
                coins,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to award Capy Coins'
            };
        }
    }

    /**
     * Converte Capy Points em Capy Coins
     * @param {string} userId - ID do usuário
     * @param {number} pointsToConvert - Pontos a converter
     * @returns {Promise<Object>} - Resultado da conversão
     */
    async convertPointsToCoins(userId, pointsToConvert) {
        try {
            const balance = this.userBalances.get(userId);
            
            if (!balance || balance.points < pointsToConvert) {
                return {
                    success: false,
                    error: 'Insufficient points balance'
                };
            }

            if (pointsToConvert % this.config.pointsToCoinsRate !== 0) {
                return {
                    success: false,
                    error: `Points must be multiple of ${this.config.pointsToCoinsRate}`
                };
            }

            const coinsToAward = pointsToConvert / this.config.pointsToCoinsRate;

            // Atualizar saldos
            balance.points -= pointsToConvert;
            balance.coins += coinsToAward;
            balance.lastUpdated = new Date().toISOString();

            this.userBalances.set(userId, balance);

            // Registrar no histórico
            this.addTransactionHistory(userId, {
                type: 'points_conversion',
                amount: coinsToAward,
                timestamp: new Date().toISOString(),
                details: {
                    pointsConverted: pointsToConvert,
                    conversionRate: this.config.pointsToCoinsRate
                }
            });

            this.logger.info(`Points converted to coins`, {
                userId,
                pointsConverted: pointsToConvert,
                coinsAwarded: coinsToAward,
                newPointsBalance: balance.points,
                newCoinsBalance: balance.coins
            });

            return {
                success: true,
                pointsConverted: pointsToConvert,
                coinsAwarded: coinsToAward,
                newPointsBalance: balance.points,
                newCoinsBalance: balance.coins
            };

        } catch (error) {
            this.logger.error('Error converting points to coins', {
                userId,
                pointsToConvert,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to convert points to coins'
            };
        }
    }

    /**
     * Calcula desconto baseado no saldo de Capy Coins
     * @param {string} userId - ID do usuário
     * @param {number} transactionAmount - Valor da transação
     * @returns {Promise<Object>} - Dados do desconto
     */
    async calculateDiscount(userId, transactionAmount) {
        try {
            const balance = this.userBalances.get(userId);
            const userCoins = balance ? balance.coins : 0;

            // Encontrar tier de desconto
            let discountPercentage = 0;
            for (let i = this.config.discountTiers.length - 1; i >= 0; i--) {
                const tier = this.config.discountTiers[i];
                if (userCoins >= tier.minCoins) {
                    discountPercentage = tier.discount;
                    break;
                }
            }

            const discountAmount = transactionAmount * discountPercentage;
            const finalAmount = transactionAmount - discountAmount;

            return {
                success: true,
                userCoins,
                discountPercentage: (discountPercentage * 100).toFixed(1) + '%',
                discountAmount: discountAmount.toFixed(2),
                originalAmount: transactionAmount.toFixed(2),
                finalAmount: finalAmount.toFixed(2),
                savings: discountAmount.toFixed(2)
            };

        } catch (error) {
            this.logger.error('Error calculating discount', {
                userId,
                transactionAmount,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to calculate discount'
            };
        }
    }

    /**
     * Obtém o saldo de recompensas de um usuário
     * @param {string} userId - ID do usuário
     * @returns {Object} - Saldo atual
     */
    getUserBalance(userId) {
        const balance = this.userBalances.get(userId) || {
            points: 0,
            coins: 0,
            lastUpdated: new Date().toISOString()
        };

        const referralStats = this.referralRewards.get(userId) || {
            totalEarned: 0,
            totalReferrals: 0,
            lastReward: null
        };

        return {
            capyPoints: balance.points.toString(),
            capyCoins: balance.coins.toString(),
            referralEarnings: referralStats.totalEarned.toString(),
            totalReferrals: referralStats.totalReferrals,
            lastUpdated: balance.lastUpdated,
            nextDiscountTier: this.getNextDiscountTier(balance.coins)
        };
    }

    /**
     * Obtém o histórico de transações de um usuário
     * @param {string} userId - ID do usuário
     * @param {number} limit - Limite de registros
     * @returns {Array} - Histórico de transações
     */
    getTransactionHistory(userId, limit = 10) {
        const history = this.transactionHistory.get(userId) || [];
        return history.slice(0, limit);
    }

    /**
     * Atualiza estatísticas de referência
     * @param {string} userId - ID do usuário
     * @param {number} rewardAmount - Valor da recompensa
     */
    updateReferralStats(userId, rewardAmount) {
        let stats = this.referralRewards.get(userId) || {
            totalEarned: 0,
            totalReferrals: 0,
            lastReward: null
        };

        stats.totalEarned += rewardAmount;
        stats.lastReward = new Date().toISOString();

        this.referralRewards.set(userId, stats);
    }

    /**
     * Adiciona transação ao histórico
     * @param {string} userId - ID do usuário
     * @param {Object} transaction - Dados da transação
     */
    addTransactionHistory(userId, transaction) {
        let history = this.transactionHistory.get(userId) || [];
        history.unshift(transaction);
        
        // Manter apenas os últimos 50 registros
        if (history.length > 50) {
            history = history.slice(0, 50);
        }

        this.transactionHistory.set(userId, history);
    }

    /**
     * Obtém próximo tier de desconto
     * @param {number} currentCoins - Coins atuais do usuário
     * @returns {Object|null} - Dados do próximo tier
     */
    getNextDiscountTier(currentCoins) {
        for (const tier of this.config.discountTiers) {
            if (currentCoins < tier.minCoins) {
                const coinsNeeded = tier.minCoins - currentCoins;
                return {
                    minCoins: tier.minCoins,
                    discount: (tier.discount * 100).toFixed(1) + '%',
                    coinsNeeded
                };
            }
        }
        return null; // Usuário já está no tier máximo
    }

    /**
     * Obtém métricas gerais do sistema de recompensas
     * @returns {Object} - Métricas do sistema
     */
    getRewardsMetrics() {
        let totalPoints = 0;
        let totalCoins = 0;
        let totalUsers = 0;
        let totalReferralEarnings = 0;

        for (const [userId, balance] of this.userBalances) {
            totalUsers++;
            totalPoints += balance.points;
            totalCoins += balance.coins;
        }

        for (const [userId, stats] of this.referralRewards) {
            totalReferralEarnings += stats.totalEarned;
        }

        return {
            totalUsers,
            totalPoints,
            totalCoins,
            totalReferralEarnings: totalReferralEarnings.toFixed(2),
            averagePointsPerUser: totalUsers > 0 ? (totalPoints / totalUsers).toFixed(2) : '0',
            averageCoinsPerUser: totalUsers > 0 ? (totalCoins / totalUsers).toFixed(2) : '0'
        };
    }
}

module.exports = RewardsService; 