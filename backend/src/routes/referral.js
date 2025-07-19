const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const ReferralService = require('../services/ReferralService');
const RewardsService = require('../services/RewardsService');
const NotificationService = require('../services/NotificationService');

const router = express.Router();

// Inicializar serviços
const referralService = new ReferralService();
const rewardsService = new RewardsService();
const notificationService = new NotificationService();

/**
 * Middleware de validação de erros
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

/**
 * Middleware de autenticação (mock para MVP)
 */
const authenticateUser = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    // Mock authentication - em produção, validar JWT
    const token = authHeader.substring(7);
    req.user = {
        id: 'user_' + Math.random().toString(36).substring(7), // Mock user ID
        name: 'Usuario Teste'
    };
    
    next();
};

/**
 * GET /api/referral/profile
 * Obtém perfil de referência do usuário autenticado
 */
router.get('/profile',
    authenticateUser,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const profile = await referralService.getReferralProfile(userId);

            if (!profile.success) {
                return res.status(400).json(profile);
            }

            res.json({
                success: true,
                data: profile
            });

        } catch (error) {
            console.error('Error getting referral profile:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/referral/generate
 * Gera novo link de referência para o usuário
 */
router.post('/generate',
    authenticateUser,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const result = await referralService.generateReferralLink(userId);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                data: {
                    referralLink: result.referralLink,
                    referralCode: result.referralCode,
                    createdAt: result.createdAt
                }
            });

        } catch (error) {
            console.error('Error generating referral link:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/referral/click/:code
 * Registra clique em link de referência
 */
router.get('/click/:code',
    [
        param('code').isLength({ min: 8, max: 20 }).withMessage('Invalid referral code format')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const referralCode = req.params.code;
            const clickData = {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                referer: req.get('Referer')
            };

            const result = await referralService.trackReferralClick(referralCode, clickData);

            if (!result.success) {
                // Redirecionar para página de erro ou homepage
                return res.redirect('https://capypay.app?error=invalid_referral');
            }

            // Redirecionar para página de registro com código de referência
            res.redirect(`https://capypay.app/signup?ref=${referralCode}`);

        } catch (error) {
            console.error('Error tracking referral click:', error);
            res.redirect('https://capypay.app?error=system_error');
        }
    }
);

/**
 * POST /api/referral/convert
 * Registra conversão de referência (usuário se registrou)
 */
router.post('/convert',
    [
        body('referralCode').isLength({ min: 8, max: 20 }).withMessage('Invalid referral code'),
        body('newUserId').notEmpty().withMessage('New user ID is required'),
        body('userData').optional().isObject()
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const { referralCode, newUserId, userData = {} } = req.body;

            // Registrar conversão
            const conversionResult = await referralService.trackReferralConversion(
                referralCode, 
                newUserId, 
                { ...userData, name: req.user.name }
            );

            if (!conversionResult.success) {
                return res.status(400).json(conversionResult);
            }

            // Processar bônus de boas-vindas
            const bonusResult = await rewardsService.processWelcomeBonus(
                newUserId,
                conversionResult.referrerId
            );

            // Enviar notificações
            const notifications = [];

            // Notificar indicador sobre novo indicado
            if (conversionResult.referrerId) {
                try {
                    const referralNotification = await notificationService.sendNewReferralNotification(
                        conversionResult.referrerId,
                        userData.name || 'Novo usuário'
                    );
                    notifications.push({
                        type: 'referrer_notification',
                        success: referralNotification.success
                    });
                } catch (notifError) {
                    console.error('Error sending referral notification:', notifError);
                }
            }

            // Notificar novo usuário sobre bônus de boas-vindas
            if (bonusResult.success && bonusResult.welcomeBonus > 0) {
                try {
                    const welcomeNotification = await notificationService.sendWelcomeBonusNotification(
                        newUserId,
                        bonusResult.welcomeBonus
                    );
                    notifications.push({
                        type: 'welcome_notification',
                        success: welcomeNotification.success
                    });
                } catch (notifError) {
                    console.error('Error sending welcome notification:', notifError);
                }
            }

            res.json({
                success: true,
                data: {
                    conversion: conversionResult,
                    bonuses: bonusResult,
                    notifications
                }
            });

        } catch (error) {
            console.error('Error processing referral conversion:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/referral/reward
 * Processa recompensa de referência baseada em transação
 */
router.post('/reward',
    [
        body('userId').notEmpty().withMessage('User ID is required'),
        body('transactionId').notEmpty().withMessage('Transaction ID is required'),
        body('feeAmount').isNumeric().withMessage('Fee amount must be numeric'),
        body('transactionType').optional().isString()
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const { userId, transactionId, feeAmount, transactionType = 'transação' } = req.body;

            // Processar recompensas de referência
            const rewardResult = await referralService.processReferralRewards(
                userId,
                parseFloat(feeAmount),
                transactionId
            );

            if (!rewardResult.success) {
                return res.status(400).json(rewardResult);
            }

            // Se há indicador, conceder recompensa via RewardsService
            if (rewardResult.hasReferrer && rewardResult.rewardProcessed) {
                const referrerId = rewardResult.referrerId;
                const rewardAmount = rewardResult.referralReward;

                // Conceder recompensa
                const awardResult = await rewardsService.awardReferralReward(
                    referrerId,
                    userId,
                    transactionId,
                    parseFloat(feeAmount)
                );

                // Enviar notificação ao indicador
                if (awardResult.success) {
                    try {
                        await notificationService.sendReferralRewardNotification(
                            referrerId,
                            req.user.name || 'Seu indicado',
                            awardResult.coinsAwarded,
                            transactionType
                        );
                    } catch (notifError) {
                        console.error('Error sending reward notification:', notifError);
                    }
                }

                res.json({
                    success: true,
                    data: {
                        referralReward: rewardResult,
                        rewardsAwarded: awardResult
                    }
                });
            } else {
                res.json({
                    success: true,
                    data: {
                        referralReward: rewardResult,
                        message: 'No referral rewards to process'
                    }
                });
            }

        } catch (error) {
            console.error('Error processing referral reward:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/referral/stats
 * Obtém estatísticas de referência do usuário
 */
router.get('/stats',
    authenticateUser,
    async (req, res) => {
        try {
            const userId = req.user.id;
            
            // Obter dados de referência
            const referralData = await referralService.getReferralProfile(userId);
            
            // Obter saldo de recompensas
            const rewardsBalance = rewardsService.getUserBalance(userId);
            
            // Obter histórico de transações de referência
            const referralHistory = rewardsService.getTransactionHistory(userId, 10)
                .filter(tx => tx.type === 'referral_reward' || tx.type === 'referral_bonus');

            res.json({
                success: true,
                data: {
                    referralInfo: referralData.success ? referralData : null,
                    rewards: rewardsBalance,
                    recentReferralRewards: referralHistory
                }
            });

        } catch (error) {
            console.error('Error getting referral stats:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/referral/leaderboard
 * Obtém leaderboard de indicadores
 */
router.get('/leaderboard',
    [
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 10;
            
            // Mock leaderboard data - em produção, buscar do banco de dados
            const leaderboard = [
                { rank: 1, userId: 'user_1', name: 'Top Referrer', totalReferred: 25, totalEarned: '150.50' },
                { rank: 2, userId: 'user_2', name: 'Super Referrer', totalReferred: 18, totalEarned: '98.25' },
                { rank: 3, userId: 'user_3', name: 'Great Referrer', totalReferred: 12, totalEarned: '67.80' }
            ].slice(0, limit);

            res.json({
                success: true,
                data: {
                    leaderboard,
                    totalEntries: leaderboard.length,
                    lastUpdated: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error getting referral leaderboard:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/referral/metrics
 * Obtém métricas gerais do programa de referência (admin)
 */
router.get('/metrics',
    authenticateUser,
    async (req, res) => {
        try {
            // Verificar se usuário é admin (mock)
            if (!req.user.id.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const referralMetrics = referralService.getReferralMetrics();
            const rewardsMetrics = rewardsService.getRewardsMetrics();

            res.json({
                success: true,
                data: {
                    referral: referralMetrics,
                    rewards: rewardsMetrics,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error getting referral metrics:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

module.exports = router; 