const express = require('express');
const { body, query, validationResult } = require('express-validator');
const NotificationService = require('../services/NotificationService');

const router = express.Router();

// Inicializar serviço
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
 * POST /api/notifications/credentials
 * Salva credenciais de notificação do usuário (URL e token do MiniKit)
 */
router.post('/credentials',
    [
        body('userId').notEmpty().withMessage('User ID is required'),
        body('notificationUrl').isURL({ protocols: ['https'] }).withMessage('Valid HTTPS URL is required'),
        body('notificationToken').isLength({ min: 10 }).withMessage('Valid notification token is required'),
        body('isFrameAdded').optional().isBoolean()
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const { userId, notificationUrl, notificationToken, isFrameAdded = true } = req.body;

            // Verificar se o userId corresponde ao usuário autenticado
            if (userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const result = await notificationService.saveUserCredentials(
                userId,
                notificationUrl,
                notificationToken
            );

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                message: 'Notification credentials saved successfully',
                data: {
                    userId,
                    isFrameAdded,
                    savedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error saving notification credentials:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/notifications/credentials
 * Obtém credenciais de notificação do usuário
 */
router.get('/credentials',
    authenticateUser,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const credentials = notificationService.getUserCredentials(userId);

            if (!credentials) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification credentials not found'
                });
            }

            // Retornar apenas informações seguras (não expor token completo)
            res.json({
                success: true,
                data: {
                    userId,
                    hasCredentials: true,
                    isActive: credentials.isActive,
                    createdAt: credentials.createdAt,
                    lastUsed: credentials.lastUsed,
                    urlDomain: new URL(credentials.url).hostname
                }
            });

        } catch (error) {
            console.error('Error getting notification credentials:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/notifications/test
 * Envia notificação de teste
 */
router.post('/test',
    [
        body('userId').notEmpty().withMessage('User ID is required'),
        body('type').optional().isString(),
        body('customMessage').optional().isObject()
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const { userId, type = 'test', customMessage } = req.body;

            // Verificar se o userId corresponde ao usuário autenticado
            if (userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            let result;

            if (customMessage) {
                // Enviar mensagem customizada
                result = await notificationService.sendNotification(userId, customMessage);
            } else {
                // Enviar notificação de teste padrão
                const testMessage = {
                    title: '🐹 Capy Pay Test',
                    body: 'Esta é uma notificação de teste! O sistema está funcionando corretamente.',
                    icon: '/icons/test.png',
                    data: {
                        type: 'test_notification',
                        timestamp: new Date().toISOString(),
                        userId
                    }
                };

                result = await notificationService.sendNotification(userId, testMessage);
            }

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                message: 'Test notification sent successfully',
                data: {
                    userId,
                    type,
                    sentAt: new Date().toISOString(),
                    result
                }
            });

        } catch (error) {
            console.error('Error sending test notification:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/notifications/send
 * Envia notificação personalizada (uso interno/admin)
 */
router.post('/send',
    [
        body('userId').notEmpty().withMessage('User ID is required'),
        body('title').isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
        body('body').isLength({ min: 1, max: 500 }).withMessage('Body must be 1-500 characters'),
        body('icon').optional().isURL(),
        body('data').optional().isObject()
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const { userId, title, body, icon, data = {} } = req.body;

            // Verificar permissões (mock admin check)
            if (!req.user.id.includes('admin') && userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const message = {
                title,
                body,
                icon: icon || '/icons/default.png',
                data: {
                    ...data,
                    type: 'custom',
                    sentBy: req.user.id,
                    timestamp: new Date().toISOString()
                }
            };

            const result = await notificationService.sendNotification(userId, message);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                message: 'Notification sent successfully',
                data: {
                    userId,
                    sentAt: new Date().toISOString(),
                    result
                }
            });

        } catch (error) {
            console.error('Error sending custom notification:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/notifications/history
 * Obtém histórico de notificações do usuário
 */
router.get('/history',
    [
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 20;

            const history = notificationService.getNotificationHistory(userId, limit);

            res.json({
                success: true,
                data: {
                    userId,
                    history,
                    totalCount: history.length,
                    lastUpdated: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error getting notification history:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/notifications/deactivate
 * Desativa notificações para o usuário
 */
router.post('/deactivate',
    authenticateUser,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const success = notificationService.deactivateUserNotifications(userId);

            if (!success) {
                return res.status(404).json({
                    success: false,
                    error: 'User notification credentials not found'
                });
            }

            res.json({
                success: true,
                message: 'Notifications deactivated successfully',
                data: {
                    userId,
                    deactivatedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error deactivating notifications:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/notifications/reactivate
 * Reativa notificações para o usuário
 */
router.post('/reactivate',
    authenticateUser,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const credentials = notificationService.getUserCredentials(userId);

            if (!credentials) {
                return res.status(404).json({
                    success: false,
                    error: 'User notification credentials not found'
                });
            }

            credentials.isActive = true;
            // Em implementação real, isso seria salvo no banco de dados

            res.json({
                success: true,
                message: 'Notifications reactivated successfully',
                data: {
                    userId,
                    reactivatedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error reactivating notifications:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/notifications/metrics
 * Obtém métricas do sistema de notificações (admin)
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

            const metrics = notificationService.getNotificationMetrics();

            res.json({
                success: true,
                data: {
                    ...metrics,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error getting notification metrics:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/notifications/bulk
 * Envia notificação em massa (admin)
 */
router.post('/bulk',
    [
        body('userIds').isArray({ min: 1 }).withMessage('User IDs array is required'),
        body('title').isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
        body('body').isLength({ min: 1, max: 500 }).withMessage('Body must be 1-500 characters'),
        body('icon').optional().isURL(),
        body('data').optional().isObject()
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            // Verificar se usuário é admin
            if (!req.user.id.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const { userIds, title, body, icon, data = {} } = req.body;

            const message = {
                title,
                body,
                icon: icon || '/icons/broadcast.png',
                data: {
                    ...data,
                    type: 'broadcast',
                    sentBy: req.user.id,
                    timestamp: new Date().toISOString()
                }
            };

            const results = [];
            let successCount = 0;
            let failureCount = 0;

            // Enviar para cada usuário
            for (const userId of userIds) {
                try {
                    const result = await notificationService.sendNotification(userId, message);
                    results.push({
                        userId,
                        success: result.success,
                        error: result.error || null
                    });

                    if (result.success) {
                        successCount++;
                    } else {
                        failureCount++;
                    }
                } catch (error) {
                    results.push({
                        userId,
                        success: false,
                        error: error.message
                    });
                    failureCount++;
                }
            }

            res.json({
                success: true,
                message: 'Bulk notification completed',
                data: {
                    totalUsers: userIds.length,
                    successCount,
                    failureCount,
                    results,
                    sentAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error sending bulk notifications:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

module.exports = router; 