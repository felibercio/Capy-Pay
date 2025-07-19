const axios = require('axios');
const winston = require('winston');

/**
 * NotificationService - Gerencia notificações push via MiniKit
 * 
 * Funcionalidades:
 * - Armazenamento de credenciais de notificação
 * - Envio de notificações via API do MiniKit/Farcaster
 * - Notificações de referência e recompensas
 * - Templates de notificação
 */
class NotificationService {
    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/notifications.log' }),
                new winston.transports.Console()
            ]
        });

        // Configurações de notificação
        this.config = {
            // URL base da API de notificações (MiniKit/Farcaster)
            apiBaseUrl: process.env.MINIKIT_NOTIFICATION_API || 'https://api.worldcoin.org/v1',
            
            // Timeout para requisições
            requestTimeout: 10000,
            
            // Retry configuration
            maxRetries: 3,
            retryDelay: 1000,
            
            // Rate limiting
            maxNotificationsPerUser: 50, // Por dia
            rateLimitWindow: 24 * 60 * 60 * 1000, // 24 horas
        };

        // Storage em memória para MVP - substituir por banco de dados
        this.userCredentials = new Map(); // userId -> { url, token, isActive, createdAt }
        this.notificationHistory = new Map(); // userId -> Array<{ type, sentAt, success, error }>
        this.rateLimits = new Map(); // userId -> { count, windowStart }

        // Templates de notificação
        this.templates = {
            referralReward: {
                title: '🎉 Recompensa de Referência!',
                body: 'Você ganhou {amount} Capy Coins! {referredName} fez uma transação.',
                icon: '/icons/capy-coins.png'
            },
            welcomeBonus: {
                title: '🐹 Bem-vindo ao Capy Pay!',
                body: 'Você ganhou {amount} Capy Coins de bônus de boas-vindas!',
                icon: '/icons/welcome.png'
            },
            newReferral: {
                title: '👥 Novo Indicado!',
                body: '{referredName} se juntou ao Capy Pay através do seu link!',
                icon: '/icons/referral.png'
            },
            transactionComplete: {
                title: '✅ Transação Concluída',
                body: 'Sua {transactionType} foi processada com sucesso!',
                icon: '/icons/success.png'
            },
            pointsEarned: {
                title: '⭐ Pontos Ganhos!',
                body: 'Você ganhou {points} Capy Points na sua última transação!',
                icon: '/icons/points.png'
            }
        };

        this.logger.info('NotificationService initialized');
    }

    /**
     * Salva credenciais de notificação de um usuário
     * @param {string} userId - ID do usuário
     * @param {string} url - URL do webhook de notificação
     * @param {string} token - Token de autenticação
     * @returns {Promise<Object>} - Resultado da operação
     */
    async saveUserCredentials(userId, url, token) {
        try {
            if (!userId || !url || !token) {
                return {
                    success: false,
                    error: 'Missing required parameters'
                };
            }

            // Validar formato da URL
            if (!this.isValidNotificationUrl(url)) {
                return {
                    success: false,
                    error: 'Invalid notification URL format'
                };
            }

            // Salvar credenciais
            this.userCredentials.set(userId, {
                url,
                token,
                isActive: true,
                createdAt: new Date().toISOString(),
                lastUsed: null
            });

            this.logger.info(`Notification credentials saved for user ${userId}`, {
                userId,
                url: url.substring(0, 50) + '...',
                tokenLength: token.length
            });

            return {
                success: true,
                message: 'Credentials saved successfully'
            };

        } catch (error) {
            this.logger.error('Error saving user credentials', {
                userId,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to save credentials'
            };
        }
    }

    /**
     * Obtém credenciais de notificação de um usuário
     * @param {string} userId - ID do usuário
     * @returns {Object|null} - Credenciais ou null se não existir
     */
    getUserCredentials(userId) {
        return this.userCredentials.get(userId) || null;
    }

    /**
     * Envia notificação de recompensa de referência
     * @param {string} referrerId - ID do indicador
     * @param {string} referredName - Nome do indicado
     * @param {number} rewardAmount - Valor da recompensa
     * @param {string} transactionType - Tipo da transação
     * @returns {Promise<Object>} - Resultado do envio
     */
    async sendReferralRewardNotification(referrerId, referredName, rewardAmount, transactionType = 'transação') {
        try {
            const template = this.templates.referralReward;
            const message = {
                title: template.title,
                body: template.body
                    .replace('{amount}', rewardAmount)
                    .replace('{referredName}', referredName),
                icon: template.icon,
                data: {
                    type: 'referral_reward',
                    referrerId,
                    rewardAmount,
                    transactionType,
                    timestamp: new Date().toISOString()
                }
            };

            const result = await this.sendNotification(referrerId, message);

            this.logger.info(`Referral reward notification sent`, {
                referrerId,
                referredName,
                rewardAmount,
                success: result.success
            });

            return result;

        } catch (error) {
            this.logger.error('Error sending referral reward notification', {
                referrerId,
                referredName,
                rewardAmount,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to send referral reward notification'
            };
        }
    }

    /**
     * Envia notificação de novo indicado
     * @param {string} referrerId - ID do indicador
     * @param {string} referredName - Nome do novo indicado
     * @returns {Promise<Object>} - Resultado do envio
     */
    async sendNewReferralNotification(referrerId, referredName) {
        try {
            const template = this.templates.newReferral;
            const message = {
                title: template.title,
                body: template.body.replace('{referredName}', referredName),
                icon: template.icon,
                data: {
                    type: 'new_referral',
                    referrerId,
                    referredName,
                    timestamp: new Date().toISOString()
                }
            };

            const result = await this.sendNotification(referrerId, message);

            this.logger.info(`New referral notification sent`, {
                referrerId,
                referredName,
                success: result.success
            });

            return result;

        } catch (error) {
            this.logger.error('Error sending new referral notification', {
                referrerId,
                referredName,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to send new referral notification'
            };
        }
    }

    /**
     * Envia notificação de bônus de boas-vindas
     * @param {string} userId - ID do novo usuário
     * @param {number} bonusAmount - Valor do bônus
     * @returns {Promise<Object>} - Resultado do envio
     */
    async sendWelcomeBonusNotification(userId, bonusAmount) {
        try {
            const template = this.templates.welcomeBonus;
            const message = {
                title: template.title,
                body: template.body.replace('{amount}', bonusAmount),
                icon: template.icon,
                data: {
                    type: 'welcome_bonus',
                    userId,
                    bonusAmount,
                    timestamp: new Date().toISOString()
                }
            };

            const result = await this.sendNotification(userId, message);

            this.logger.info(`Welcome bonus notification sent`, {
                userId,
                bonusAmount,
                success: result.success
            });

            return result;

        } catch (error) {
            this.logger.error('Error sending welcome bonus notification', {
                userId,
                bonusAmount,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to send welcome bonus notification'
            };
        }
    }

    /**
     * Envia notificação de transação concluída
     * @param {string} userId - ID do usuário
     * @param {string} transactionType - Tipo da transação
     * @param {Object} details - Detalhes adicionais
     * @returns {Promise<Object>} - Resultado do envio
     */
    async sendTransactionCompleteNotification(userId, transactionType, details = {}) {
        try {
            const template = this.templates.transactionComplete;
            const message = {
                title: template.title,
                body: template.body.replace('{transactionType}', transactionType),
                icon: template.icon,
                data: {
                    type: 'transaction_complete',
                    userId,
                    transactionType,
                    details,
                    timestamp: new Date().toISOString()
                }
            };

            const result = await this.sendNotification(userId, message);

            this.logger.info(`Transaction complete notification sent`, {
                userId,
                transactionType,
                success: result.success
            });

            return result;

        } catch (error) {
            this.logger.error('Error sending transaction complete notification', {
                userId,
                transactionType,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to send transaction complete notification'
            };
        }
    }

    /**
     * Envia notificação de pontos ganhos
     * @param {string} userId - ID do usuário
     * @param {number} points - Pontos ganhos
     * @returns {Promise<Object>} - Resultado do envio
     */
    async sendPointsEarnedNotification(userId, points) {
        try {
            const template = this.templates.pointsEarned;
            const message = {
                title: template.title,
                body: template.body.replace('{points}', points),
                icon: template.icon,
                data: {
                    type: 'points_earned',
                    userId,
                    points,
                    timestamp: new Date().toISOString()
                }
            };

            const result = await this.sendNotification(userId, message);

            this.logger.info(`Points earned notification sent`, {
                userId,
                points,
                success: result.success
            });

            return result;

        } catch (error) {
            this.logger.error('Error sending points earned notification', {
                userId,
                points,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to send points earned notification'
            };
        }
    }

    /**
     * Envia uma notificação genérica
     * @param {string} userId - ID do usuário
     * @param {Object} message - Dados da mensagem
     * @returns {Promise<Object>} - Resultado do envio
     */
    async sendNotification(userId, message) {
        try {
            // Verificar rate limiting
            if (!this.checkRateLimit(userId)) {
                return {
                    success: false,
                    error: 'Rate limit exceeded'
                };
            }

            // Obter credenciais do usuário
            const credentials = this.getUserCredentials(userId);
            if (!credentials || !credentials.isActive) {
                return {
                    success: false,
                    error: 'User notification credentials not found or inactive'
                };
            }

            // Preparar payload da notificação
            const payload = {
                notification: {
                    title: message.title,
                    body: message.body,
                    icon: message.icon || '/icons/default.png'
                },
                data: message.data || {},
                timestamp: new Date().toISOString()
            };

            // Enviar notificação via HTTP
            const result = await this.sendHttpNotification(credentials.url, credentials.token, payload);

            // Registrar no histórico
            this.addNotificationHistory(userId, {
                type: message.data?.type || 'generic',
                sentAt: new Date().toISOString(),
                success: result.success,
                error: result.error || null,
                message: {
                    title: message.title,
                    body: message.body
                }
            });

            // Atualizar credenciais com último uso
            if (result.success) {
                credentials.lastUsed = new Date().toISOString();
                this.userCredentials.set(userId, credentials);
            }

            return result;

        } catch (error) {
            this.logger.error('Error sending notification', {
                userId,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to send notification'
            };
        }
    }

    /**
     * Envia notificação via HTTP para a URL do MiniKit
     * @param {string} url - URL do webhook
     * @param {string} token - Token de autenticação
     * @param {Object} payload - Dados da notificação
     * @returns {Promise<Object>} - Resultado do envio
     */
    async sendHttpNotification(url, token, payload) {
        let lastError = null;

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                const response = await axios.post(url, payload, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Capy-Pay-Notification-Service/1.0'
                    },
                    timeout: this.config.requestTimeout
                });

                if (response.status >= 200 && response.status < 300) {
                    this.logger.info(`Notification sent successfully`, {
                        url: url.substring(0, 50) + '...',
                        status: response.status,
                        attempt
                    });

                    return {
                        success: true,
                        status: response.status,
                        response: response.data
                    };
                } else {
                    lastError = `HTTP ${response.status}: ${response.statusText}`;
                }

            } catch (error) {
                lastError = error.message;
                
                this.logger.warn(`Notification attempt ${attempt} failed`, {
                    url: url.substring(0, 50) + '...',
                    error: error.message,
                    attempt
                });

                // Wait before retry (except on last attempt)
                if (attempt < this.config.maxRetries) {
                    await this.sleep(this.config.retryDelay * attempt);
                }
            }
        }

        this.logger.error(`All notification attempts failed`, {
            url: url.substring(0, 50) + '...',
            attempts: this.config.maxRetries,
            lastError
        });

        return {
            success: false,
            error: `Failed after ${this.config.maxRetries} attempts: ${lastError}`
        };
    }

    /**
     * Verifica rate limiting para um usuário
     * @param {string} userId - ID do usuário
     * @returns {boolean} - Se pode enviar notificação
     */
    checkRateLimit(userId) {
        const now = Date.now();
        let userLimit = this.rateLimits.get(userId);

        if (!userLimit) {
            userLimit = {
                count: 0,
                windowStart: now
            };
        }

        // Reset window if expired
        if (now - userLimit.windowStart > this.config.rateLimitWindow) {
            userLimit = {
                count: 0,
                windowStart: now
            };
        }

        // Check if limit exceeded
        if (userLimit.count >= this.config.maxNotificationsPerUser) {
            return false;
        }

        // Increment counter
        userLimit.count++;
        this.rateLimits.set(userId, userLimit);

        return true;
    }

    /**
     * Adiciona notificação ao histórico
     * @param {string} userId - ID do usuário
     * @param {Object} notification - Dados da notificação
     */
    addNotificationHistory(userId, notification) {
        let history = this.notificationHistory.get(userId) || [];
        history.unshift(notification);
        
        // Manter apenas os últimos 100 registros
        if (history.length > 100) {
            history = history.slice(0, 100);
        }

        this.notificationHistory.set(userId, history);
    }

    /**
     * Obtém histórico de notificações de um usuário
     * @param {string} userId - ID do usuário
     * @param {number} limit - Limite de registros
     * @returns {Array} - Histórico de notificações
     */
    getNotificationHistory(userId, limit = 20) {
        const history = this.notificationHistory.get(userId) || [];
        return history.slice(0, limit);
    }

    /**
     * Valida formato de URL de notificação
     * @param {string} url - URL para validar
     * @returns {boolean} - Se é válida
     */
    isValidNotificationUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.protocol === 'https:' && parsedUrl.hostname.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Sleep utility para delays
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} - Promise that resolves after delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Desativa notificações para um usuário
     * @param {string} userId - ID do usuário
     * @returns {boolean} - Sucesso da operação
     */
    deactivateUserNotifications(userId) {
        const credentials = this.userCredentials.get(userId);
        if (credentials) {
            credentials.isActive = false;
            this.userCredentials.set(userId, credentials);
            return true;
        }
        return false;
    }

    /**
     * Obtém métricas do sistema de notificações
     * @returns {Object} - Métricas do sistema
     */
    getNotificationMetrics() {
        let totalUsers = 0;
        let activeUsers = 0;
        let totalSent = 0;
        let totalSuccessful = 0;

        for (const [userId, credentials] of this.userCredentials) {
            totalUsers++;
            if (credentials.isActive) {
                activeUsers++;
            }
        }

        for (const [userId, history] of this.notificationHistory) {
            for (const notification of history) {
                totalSent++;
                if (notification.success) {
                    totalSuccessful++;
                }
            }
        }

        const successRate = totalSent > 0 ? (totalSuccessful / totalSent * 100).toFixed(2) + '%' : '0%';

        return {
            totalUsers,
            activeUsers,
            totalSent,
            totalSuccessful,
            successRate,
            rateLimitedUsers: this.rateLimits.size
        };
    }
}

module.exports = NotificationService; 