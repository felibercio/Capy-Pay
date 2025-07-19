const crypto = require('crypto');
const winston = require('winston');

/**
 * ReferralService - Gerencia o programa de referência do Capy Pay
 * 
 * Funcionalidades:
 * - Geração de links de referência únicos e seguros
 * - Rastreamento de indicações e conversões
 * - Cálculo e distribuição de recompensas
 * - Integração com RewardsService
 */
class ReferralService {
    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/referral.log' }),
                new winston.transports.Console()
            ]
        });

        // Base URL para links de referência
        this.baseUrl = process.env.REFERRAL_BASE_URL || 'https://capypay.app';
        
        // Configurações de recompensa
        this.config = {
            // Percentual das taxas que vai para o indicador
            referralFeePercentage: 0.10, // 10%
            
            // Recompensa fixa por indicação bem-sucedida
            referralBonusAmount: 50, // 50 Capy Coins
            
            // Recompensa para o indicado
            welcomeBonusAmount: 25, // 25 Capy Coins
            
            // Período de validade do link (dias)
            linkValidityDays: 365,
            
            // Tempo mínimo para considerar conversão válida (horas)
            minConversionTimeHours: 1
        };

        // Storage em memória para MVP - substituir por banco de dados
        this.referralLinks = new Map(); // userId -> { code, createdAt, clicks, conversions }
        this.referralTracking = new Map(); // referralCode -> { referrerId, createdAt }
        this.conversions = new Map(); // userId -> { referrerId, convertedAt, rewardsPaid }
        this.referralStats = new Map(); // userId -> { totalReferred, totalRewardsEarned, recentReferrals }

        this.logger.info('ReferralService initialized');
    }

    /**
     * Gera um link de referência único para um usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Dados do link de referência
     */
    async generateReferralLink(userId) {
        try {
            // Verificar se já existe um link ativo para o usuário
            let existingLink = this.referralLinks.get(userId);
            
            if (existingLink && this.isLinkValid(existingLink.createdAt)) {
                const fullLink = `${this.baseUrl}/ref/${existingLink.code}`;
                
                return {
                    success: true,
                    referralLink: fullLink,
                    referralCode: existingLink.code,
                    createdAt: existingLink.createdAt,
                    clicks: existingLink.clicks,
                    conversions: existingLink.conversions
                };
            }

            // Gerar novo código seguro
            const referralCode = this.generateSecureCode(userId);
            const createdAt = new Date().toISOString();
            const fullLink = `${this.baseUrl}/ref/${referralCode}`;

            // Armazenar link
            this.referralLinks.set(userId, {
                code: referralCode,
                createdAt,
                clicks: 0,
                conversions: 0
            });

            // Armazenar rastreamento reverso
            this.referralTracking.set(referralCode, {
                referrerId: userId,
                createdAt
            });

            this.logger.info(`Referral link generated for user ${userId}`, {
                userId,
                referralCode,
                fullLink
            });

            return {
                success: true,
                referralLink: fullLink,
                referralCode,
                createdAt,
                clicks: 0,
                conversions: 0
            };

        } catch (error) {
            this.logger.error('Error generating referral link', {
                userId,
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: 'Failed to generate referral link'
            };
        }
    }

    /**
     * Registra um clique no link de referência
     * @param {string} referralCode - Código de referência
     * @param {Object} clickData - Dados do clique (IP, user agent, etc.)
     * @returns {Promise<Object>} - Resultado do registro
     */
    async trackReferralClick(referralCode, clickData = {}) {
        try {
            const tracking = this.referralTracking.get(referralCode);
            
            if (!tracking) {
                return {
                    success: false,
                    error: 'Invalid referral code'
                };
            }

            // Verificar se o link ainda é válido
            if (!this.isLinkValid(tracking.createdAt)) {
                return {
                    success: false,
                    error: 'Referral link has expired'
                };
            }

            // Incrementar contador de cliques
            const referrerLink = this.referralLinks.get(tracking.referrerId);
            if (referrerLink) {
                referrerLink.clicks++;
            }

            this.logger.info(`Referral click tracked`, {
                referralCode,
                referrerId: tracking.referrerId,
                clickData: {
                    ip: clickData.ip,
                    userAgent: clickData.userAgent,
                    timestamp: new Date().toISOString()
                }
            });

            return {
                success: true,
                referrerId: tracking.referrerId,
                isValid: true
            };

        } catch (error) {
            this.logger.error('Error tracking referral click', {
                referralCode,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to track referral click'
            };
        }
    }

    /**
     * Registra uma nova conversão (usuário se registrou via referência)
     * @param {string} referralCode - Código de referência usado
     * @param {string} newUserId - ID do novo usuário
     * @param {Object} userData - Dados do novo usuário
     * @returns {Promise<Object>} - Resultado da conversão
     */
    async trackReferralConversion(referralCode, newUserId, userData = {}) {
        try {
            const tracking = this.referralTracking.get(referralCode);
            
            if (!tracking) {
                return {
                    success: false,
                    error: 'Invalid referral code'
                };
            }

            // Verificar se o usuário já foi convertido antes
            if (this.conversions.has(newUserId)) {
                return {
                    success: false,
                    error: 'User already converted via referral'
                };
            }

            // Verificar se não é auto-referência
            if (tracking.referrerId === newUserId) {
                return {
                    success: false,
                    error: 'Self-referral not allowed'
                };
            }

            const convertedAt = new Date().toISOString();

            // Registrar conversão
            this.conversions.set(newUserId, {
                referrerId: tracking.referrerId,
                referralCode,
                convertedAt,
                rewardsPaid: false,
                userData
            });

            // Atualizar contador de conversões
            const referrerLink = this.referralLinks.get(tracking.referrerId);
            if (referrerLink) {
                referrerLink.conversions++;
            }

            // Atualizar estatísticas do indicador
            this.updateReferrerStats(tracking.referrerId, newUserId, userData);

            this.logger.info(`Referral conversion tracked`, {
                referralCode,
                referrerId: tracking.referrerId,
                newUserId,
                convertedAt
            });

            return {
                success: true,
                referrerId: tracking.referrerId,
                convertedAt,
                welcomeBonusEligible: true
            };

        } catch (error) {
            this.logger.error('Error tracking referral conversion', {
                referralCode,
                newUserId,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to track referral conversion'
            };
        }
    }

    /**
     * Calcula e processa recompensas de referência baseadas em transação
     * @param {string} userId - ID do usuário que fez a transação
     * @param {number} feeAmount - Valor da taxa gerada
     * @param {string} transactionId - ID da transação
     * @returns {Promise<Object>} - Resultado do processamento de recompensas
     */
    async processReferralRewards(userId, feeAmount, transactionId) {
        try {
            const conversion = this.conversions.get(userId);
            
            if (!conversion) {
                // Usuário não veio via referência
                return {
                    success: true,
                    hasReferrer: false
                };
            }

            const referrerId = conversion.referrerId;
            const referralReward = feeAmount * this.config.referralFeePercentage;

            // Verificar se a conversão é válida (tempo mínimo passou)
            const conversionTime = new Date(conversion.convertedAt);
            const minTime = new Date(conversionTime.getTime() + (this.config.minConversionTimeHours * 60 * 60 * 1000));
            
            if (new Date() < minTime) {
                this.logger.info(`Referral reward delayed - minimum time not met`, {
                    userId,
                    referrerId,
                    transactionId
                });
                
                return {
                    success: true,
                    hasReferrer: true,
                    rewardProcessed: false,
                    reason: 'minimum_time_not_met'
                };
            }

            // Processar recompensa via RewardsService (será integrado)
            const rewardResult = await this.awardReferralReward(
                referrerId,
                userId,
                referralReward,
                transactionId
            );

            if (rewardResult.success) {
                // Atualizar estatísticas
                this.updateReferrerRewardStats(referrerId, referralReward);
                
                // Marcar recompensas como pagas
                conversion.rewardsPaid = true;
                conversion.lastRewardAt = new Date().toISOString();
                conversion.totalRewardsEarned = (conversion.totalRewardsEarned || 0) + referralReward;
            }

            this.logger.info(`Referral rewards processed`, {
                userId,
                referrerId,
                referralReward,
                transactionId,
                success: rewardResult.success
            });

            return {
                success: true,
                hasReferrer: true,
                rewardProcessed: rewardResult.success,
                referrerId,
                referralReward,
                transactionId
            };

        } catch (error) {
            this.logger.error('Error processing referral rewards', {
                userId,
                feeAmount,
                transactionId,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to process referral rewards'
            };
        }
    }

    /**
     * Obtém o perfil de referência de um usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Dados do perfil de referência
     */
    async getReferralProfile(userId) {
        try {
            // Gerar link se não existir
            const linkData = await this.generateReferralLink(userId);
            
            if (!linkData.success) {
                return linkData;
            }

            // Obter estatísticas
            const stats = this.referralStats.get(userId) || {
                totalReferred: 0,
                totalRewardsEarned: '0',
                recentReferrals: []
            };

            return {
                success: true,
                referralLink: linkData.referralLink,
                referralCode: linkData.referralCode,
                totalReferred: stats.totalReferred,
                totalRewardsEarned: stats.totalRewardsEarned,
                recentReferrals: stats.recentReferrals,
                clicks: linkData.clicks,
                conversions: linkData.conversions,
                conversionRate: linkData.clicks > 0 ? (linkData.conversions / linkData.clicks * 100).toFixed(2) + '%' : '0%'
            };

        } catch (error) {
            this.logger.error('Error getting referral profile', {
                userId,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to get referral profile'
            };
        }
    }

    /**
     * Obtém dados de um código de referência
     * @param {string} referralCode - Código de referência
     * @returns {Object} - Dados do código
     */
    getReferralData(referralCode) {
        const tracking = this.referralTracking.get(referralCode);
        
        if (!tracking) {
            return null;
        }

        return {
            referrerId: tracking.referrerId,
            createdAt: tracking.createdAt,
            isValid: this.isLinkValid(tracking.createdAt)
        };
    }

    /**
     * Gera um código de referência seguro
     * @param {string} userId - ID do usuário
     * @returns {string} - Código gerado
     */
    generateSecureCode(userId) {
        const timestamp = Date.now().toString();
        const random = crypto.randomBytes(8).toString('hex');
        const hash = crypto.createHash('sha256')
            .update(userId + timestamp + random)
            .digest('hex');
        
        // Usar apenas os primeiros 12 caracteres para um código mais limpo
        return hash.substring(0, 12);
    }

    /**
     * Verifica se um link ainda é válido
     * @param {string} createdAt - Data de criação
     * @returns {boolean} - Se é válido
     */
    isLinkValid(createdAt) {
        const created = new Date(createdAt);
        const expiry = new Date(created.getTime() + (this.config.linkValidityDays * 24 * 60 * 60 * 1000));
        return new Date() < expiry;
    }

    /**
     * Atualiza estatísticas do indicador
     * @param {string} referrerId - ID do indicador
     * @param {string} newUserId - ID do novo usuário
     * @param {Object} userData - Dados do usuário
     */
    updateReferrerStats(referrerId, newUserId, userData) {
        let stats = this.referralStats.get(referrerId) || {
            totalReferred: 0,
            totalRewardsEarned: '0',
            recentReferrals: []
        };

        stats.totalReferred++;
        
        // Adicionar à lista de referências recentes (máximo 5)
        stats.recentReferrals.unshift({
            userId: newUserId,
            userName: userData.name || 'Usuário',
            rewardEarned: '0', // Será atualizado quando a primeira recompensa for paga
            date: new Date().toLocaleDateString('pt-BR')
        });

        // Manter apenas os 5 mais recentes
        if (stats.recentReferrals.length > 5) {
            stats.recentReferrals = stats.recentReferrals.slice(0, 5);
        }

        this.referralStats.set(referrerId, stats);
    }

    /**
     * Atualiza estatísticas de recompensas do indicador
     * @param {string} referrerId - ID do indicador
     * @param {number} rewardAmount - Valor da recompensa
     */
    updateReferrerRewardStats(referrerId, rewardAmount) {
        let stats = this.referralStats.get(referrerId) || {
            totalReferred: 0,
            totalRewardsEarned: '0',
            recentReferrals: []
        };

        const currentTotal = parseFloat(stats.totalRewardsEarned) || 0;
        stats.totalRewardsEarned = (currentTotal + rewardAmount).toFixed(2);

        // Atualizar a referência mais recente com a recompensa
        if (stats.recentReferrals.length > 0) {
            stats.recentReferrals[0].rewardEarned = rewardAmount.toFixed(2);
        }

        this.referralStats.set(referrerId, stats);
    }

    /**
     * Concede recompensa de referência (integração com RewardsService)
     * @param {string} referrerId - ID do indicador
     * @param {string} referredUserId - ID do indicado
     * @param {number} rewardAmount - Valor da recompensa
     * @param {string} transactionId - ID da transação
     * @returns {Promise<Object>} - Resultado da concessão
     */
    async awardReferralReward(referrerId, referredUserId, rewardAmount, transactionId) {
        try {
            // Placeholder para integração com RewardsService
            // Em implementação real, isso chamaria RewardsService.awardCapyCoins()
            
            this.logger.info(`Referral reward awarded`, {
                referrerId,
                referredUserId,
                rewardAmount,
                transactionId,
                type: 'referral_fee_share'
            });

            // Simular sucesso por enquanto
            return {
                success: true,
                rewardAmount,
                transactionId
            };

        } catch (error) {
            this.logger.error('Error awarding referral reward', {
                referrerId,
                referredUserId,
                rewardAmount,
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
     * Obtém métricas gerais do programa de referência
     * @returns {Object} - Métricas do programa
     */
    getReferralMetrics() {
        let totalLinks = 0;
        let totalClicks = 0;
        let totalConversions = 0;
        let totalRewardsDistributed = 0;

        for (const [userId, linkData] of this.referralLinks) {
            totalLinks++;
            totalClicks += linkData.clicks;
            totalConversions += linkData.conversions;
        }

        for (const [userId, stats] of this.referralStats) {
            totalRewardsDistributed += parseFloat(stats.totalRewardsEarned) || 0;
        }

        return {
            totalLinks,
            totalClicks,
            totalConversions,
            totalRewardsDistributed: totalRewardsDistributed.toFixed(2),
            conversionRate: totalClicks > 0 ? (totalConversions / totalClicks * 100).toFixed(2) + '%' : '0%',
            activeUsers: this.referralStats.size
        };
    }
}

module.exports = ReferralService; 