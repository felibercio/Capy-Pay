const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const BRcapyService = require('../services/BRcapyService');
const PoolManagementService = require('../services/PoolManagementService');

const router = express.Router();

// Inicializar serviços
const brcapyService = new BRcapyService();
const poolService = new PoolManagementService();

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
        name: 'Usuario Teste',
        email: 'teste@email.com'
    };
    
    next();
};

/**
 * GET /api/brcapy/dashboard
 * Obtém dados completos da BRcapy para dashboard
 */
router.get('/dashboard',
    async (req, res) => {
        try {
            const dashboardData = await brcapyService.getBRcapyDashboardData();

            if (!dashboardData.success) {
                return res.status(400).json(dashboardData);
            }

            res.json({
                success: true,
                data: dashboardData.data,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error getting BRcapy dashboard:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/brcapy/user/:userId
 * Obtém dados da BRcapy específicos do usuário
 */
router.get('/user/:userId',
    [
        param('userId').notEmpty().withMessage('User ID is required')
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const { userId } = req.params;

            // Verificar se o userId corresponde ao usuário autenticado
            if (userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const userData = await brcapyService.getBRcapyValueForUser(userId);

            if (!userData.success) {
                return res.status(400).json(userData);
            }

            res.json({
                success: true,
                data: userData.data,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error getting user BRcapy data:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/brcapy/current-value
 * Obtém o valor atual da BRcapy
 */
router.get('/current-value',
    async (req, res) => {
        try {
            const dashboardData = await brcapyService.getBRcapyDashboardData();

            if (!dashboardData.success) {
                return res.status(400).json(dashboardData);
            }

            res.json({
                success: true,
                data: {
                    currentValue: dashboardData.data.currentValue,
                    lastUpdate: dashboardData.data.lastUpdate,
                    apy: dashboardData.data.metrics.apy,
                    averageDailyYield: dashboardData.data.metrics.averageDailyYield
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error getting current BRcapy value:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/brcapy/distribute
 * Distribui BRcapy para um usuário
 */
router.post('/distribute',
    [
        body('userId').notEmpty().withMessage('User ID is required'),
        body('amount').isNumeric().withMessage('Amount must be numeric'),
        body('amount').isFloat({ min: 0.00000001 }).withMessage('Amount must be greater than 0'),
        body('reason').optional().isString().withMessage('Reason must be a string')
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const { userId, amount, reason = 'distribution' } = req.body;

            // Verificar permissões (em produção, apenas admins ou sistema podem distribuir)
            if (!req.user.id.includes('admin') && !req.user.id.includes('system')) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied - admin required'
                });
            }

            const result = await brcapyService.distributeBRcapy(userId, parseFloat(amount), reason);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error distributing BRcapy:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/brcapy/redeem
 * Resgata BRcapy de um usuário
 */
router.post('/redeem',
    [
        body('userId').notEmpty().withMessage('User ID is required'),
        body('amount').isNumeric().withMessage('Amount must be numeric'),
        body('amount').isFloat({ min: 0.00000001 }).withMessage('Amount must be greater than 0'),
        body('targetAsset').optional().isIn(['BRL', 'USDC', 'USDT', 'BUSD']).withMessage('Invalid target asset')
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const { userId, amount, targetAsset = 'BRL' } = req.body;

            // Verificar se o userId corresponde ao usuário autenticado
            if (userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            // Processar resgate na pool
            const poolResult = await poolService.processRedemption(
                userId, 
                parseFloat(amount), 
                targetAsset
            );

            if (!poolResult.success) {
                return res.status(400).json(poolResult);
            }

            // Processar resgate no BRcapy service
            const brcapyResult = await brcapyService.redeemBRcapy(
                userId, 
                parseFloat(amount), 
                targetAsset
            );

            if (!brcapyResult.success) {
                return res.status(400).json(brcapyResult);
            }

            res.json({
                success: true,
                data: {
                    ...brcapyResult.data,
                    poolTransaction: poolResult.data
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error redeeming BRcapy:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/brcapy/history/:userId
 * Obtém histórico de transações BRcapy do usuário
 */
router.get('/history/:userId',
    [
        param('userId').notEmpty().withMessage('User ID is required'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
        query('type').optional().isIn(['distribution', 'redemption', 'daily_yield']).withMessage('Invalid transaction type')
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const { userId } = req.params;
            const limit = parseInt(req.query.limit) || 50;
            const type = req.query.type;

            // Verificar se o userId corresponde ao usuário autenticado
            if (userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const userData = await brcapyService.getBRcapyValueForUser(userId);

            if (!userData.success) {
                return res.status(400).json(userData);
            }

            let history = userData.data.history || [];

            // Filtrar por tipo se especificado
            if (type) {
                history = history.filter(tx => tx.type === type);
            }

            // Aplicar limite
            history = history.slice(0, limit);

            res.json({
                success: true,
                data: {
                    userId,
                    transactions: history,
                    totalCount: history.length,
                    currentBalance: userData.data.balance,
                    currentValue: userData.data.valueInBRL
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error getting BRcapy history:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/brcapy/pool
 * Obtém dados da pool de lastro
 */
router.get('/pool',
    async (req, res) => {
        try {
            const poolData = await poolService.getPoolDashboardData();

            if (!poolData.success) {
                return res.status(400).json(poolData);
            }

            res.json({
                success: true,
                data: poolData.data,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error getting pool data:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/brcapy/process-transaction-revenue
 * Processa revenue de uma transação do app (uso interno)
 */
router.post('/process-transaction-revenue',
    [
        body('transactionType').isIn(['crypto_swap', 'boleto_payment', 'pix_transfer', 'international_transfer', 'card_transaction']).withMessage('Invalid transaction type'),
        body('transactionAmount').isNumeric().withMessage('Transaction amount must be numeric'),
        body('transactionAmount').isFloat({ min: 0.01 }).withMessage('Transaction amount must be greater than 0.01'),
        body('asset').optional().isIn(['BRL', 'USDC', 'USDT', 'BUSD', 'USD']).withMessage('Invalid asset'),
        body('metadata').optional().isObject()
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { transactionType, transactionAmount, asset = 'BRL', metadata = {} } = req.body;

            // Verificar se é uma chamada interna do sistema
            const internalApiKey = req.headers['x-internal-api-key'];
            if (internalApiKey !== process.env.INTERNAL_API_KEY) {
                return res.status(403).json({
                    success: false,
                    error: 'Internal API access required'
                });
            }

            const result = await poolService.processTransactionRevenue(
                transactionType,
                parseFloat(transactionAmount),
                asset,
                {
                    ...metadata,
                    processedAt: new Date().toISOString(),
                    source: 'api_call'
                }
            );

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error processing transaction revenue:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/brcapy/force-update
 * Força atualização do valor da BRcapy (admin only)
 */
router.post('/force-update',
    authenticateUser,
    async (req, res) => {
        try {
            // Verificar se usuário é admin
            if (!req.user.id.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied - admin required'
                });
            }

            const result = await brcapyService.forceUpdate();

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                message: 'BRcapy value updated successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error forcing BRcapy update:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/brcapy/metrics
 * Obtém métricas do sistema BRcapy (admin only)
 */
router.get('/metrics',
    authenticateUser,
    async (req, res) => {
        try {
            // Verificar se usuário é admin
            if (!req.user.id.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied - admin required'
                });
            }

            const brcapyMetrics = brcapyService.getSystemMetrics();
            const poolMetrics = poolService.getSystemMetrics();

            res.json({
                success: true,
                data: {
                    brcapy: brcapyMetrics,
                    pool: poolMetrics,
                    system: {
                        uptime: process.uptime(),
                        memoryUsage: process.memoryUsage(),
                        timestamp: new Date().toISOString()
                    }
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error getting BRcapy metrics:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/brcapy/cdi-data
 * Obtém dados atuais do CDI
 */
router.get('/cdi-data',
    async (req, res) => {
        try {
            // Buscar dados CDI através do BRcapy service
            const cdiData = await brcapyService.fetchCurrentCDI();

            if (!cdiData.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Failed to fetch CDI data',
                    details: cdiData.error
                });
            }

            res.json({
                success: true,
                data: {
                    rate: cdiData.rate,
                    date: cdiData.date,
                    source: cdiData.source,
                    dailyRate: (cdiData.rate / 365 / 100).toFixed(8),
                    note: cdiData.note
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error getting CDI data:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/brcapy/yield-calculation
 * Simula cálculo de rendimento para um valor específico
 */
router.get('/yield-calculation',
    [
        query('amount').isNumeric().withMessage('Amount must be numeric'),
        query('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0.01'),
        query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const amount = parseFloat(req.query.amount);
            const days = parseInt(req.query.days) || 30;

            // Obter dados atuais da BRcapy
            const dashboardData = await brcapyService.getBRcapyDashboardData();
            
            if (!dashboardData.success) {
                return res.status(400).json(dashboardData);
            }

            const currentValue = parseFloat(dashboardData.data.currentValue);
            const averageDailyYield = parseFloat(dashboardData.data.metrics.averageDailyYield) / 100;

            // Calcular BRcapy tokens que seria possível comprar
            const brcapyTokens = amount / currentValue;

            // Simular rendimento
            let projectedValue = currentValue;
            const dailyYields = [];

            for (let day = 1; day <= days; day++) {
                // Usar yield médio com pequena variação aleatória
                const dailyYield = averageDailyYield * (0.8 + Math.random() * 0.4); // ±20% variação
                projectedValue = projectedValue * (1 + dailyYield);
                
                dailyYields.push({
                    day,
                    brcapyValue: projectedValue.toFixed(8),
                    userBalance: (brcapyTokens * projectedValue).toFixed(2),
                    dailyReturn: (dailyYield * 100).toFixed(4) + '%'
                });
            }

            const finalValue = brcapyTokens * projectedValue;
            const totalReturn = ((finalValue - amount) / amount) * 100;
            const annualizedReturn = (Math.pow(finalValue / amount, 365 / days) - 1) * 100;

            res.json({
                success: true,
                data: {
                    input: {
                        investmentAmount: amount.toFixed(2),
                        projectionDays: days,
                        currentBRcapyPrice: currentValue.toFixed(8)
                    },
                    projection: {
                        brcapyTokens: brcapyTokens.toFixed(8),
                        finalValue: finalValue.toFixed(2),
                        totalReturn: totalReturn.toFixed(4) + '%',
                        annualizedReturn: annualizedReturn.toFixed(4) + '%',
                        averageDailyYield: (averageDailyYield * 100).toFixed(4) + '%'
                    },
                    dailyProjections: dailyYields.slice(-7), // Últimos 7 dias para não sobrecarregar
                    disclaimer: 'Esta é uma simulação baseada no rendimento histórico. Resultados reais podem variar.'
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error calculating yield projection:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

module.exports = router; 