const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const KYCService = require('../services/KYCService');
const LimitService = require('../services/LimitService');
const NotificationService = require('../services/NotificationService');

const router = express.Router();

// Inicializar serviços
const kycService = new KYCService();
const limitService = new LimitService(kycService);
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
        name: 'Usuario Teste',
        email: 'teste@email.com'
    };
    
    next();
};

/**
 * GET /api/kyc/status
 * Obtém status KYC atual do usuário
 */
router.get('/status',
    authenticateUser,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const kycStatus = await kycService.checkUserKYCStatus(userId);

            if (!kycStatus.success) {
                return res.status(400).json(kycStatus);
            }

            // Incluir estatísticas de limite
            const limitStats = await limitService.getUserLimitStats(userId);

            res.json({
                success: true,
                data: {
                    kyc: kycStatus,
                    limits: limitStats.success ? limitStats.data : null
                }
            });

        } catch (error) {
            console.error('Error getting KYC status:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/kyc/level1
 * Inicia verificação KYC Nível 1 (dados básicos)
 */
router.post('/level1',
    [
        body('userId').notEmpty().withMessage('User ID is required'),
        body('nomeCompleto').isLength({ min: 5 }).withMessage('Nome completo deve ter pelo menos 5 caracteres'),
        body('cpf').matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/).withMessage('CPF deve estar no formato 000.000.000-00'),
        body('dataNascimento').isISO8601().withMessage('Data de nascimento deve ser válida'),
        body('telefone').matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/).withMessage('Telefone deve estar no formato (11) 99999-9999'),
        body('email').isEmail().withMessage('Email deve ser válido'),
        body('endereco').isObject().withMessage('Endereço é obrigatório'),
        body('endereco.cep').matches(/^\d{5}-\d{3}$/).withMessage('CEP deve estar no formato 00000-000'),
        body('endereco.logradouro').notEmpty().withMessage('Logradouro é obrigatório'),
        body('endereco.numero').notEmpty().withMessage('Número é obrigatório'),
        body('endereco.bairro').notEmpty().withMessage('Bairro é obrigatório'),
        body('endereco.cidade').notEmpty().withMessage('Cidade é obrigatória'),
        body('endereco.estado').isLength({ min: 2, max: 2 }).withMessage('Estado deve ter 2 caracteres'),
        body('ipAddress').optional().isIP(),
        body('userAgent').optional().isString()
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const {
                userId,
                nomeCompleto,
                cpf,
                dataNascimento,
                telefone,
                email,
                endereco,
                ipAddress,
                userAgent
            } = req.body;

            // Verificar se o userId corresponde ao usuário autenticado
            if (userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            // Remover formatação do CPF para validação
            const cleanCPF = cpf.replace(/[^\d]/g, '');

            const result = await kycService.initiateKYCLevel1(userId, {
                nomeCompleto,
                cpf: cleanCPF,
                dataNascimento,
                telefone,
                email,
                endereco,
                ipAddress: ipAddress || req.ip,
                userAgent: userAgent || req.get('User-Agent')
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Se verificação foi aprovada automaticamente, enviar notificação
            if (result.status === 'verified') {
                try {
                    await notificationService.sendNotification(userId, {
                        title: '✅ KYC Nível 1 Aprovado!',
                        body: 'Sua verificação básica foi aprovada. Seus limites foram ampliados!',
                        icon: '/icons/kyc-approved.png',
                        data: {
                            type: 'kyc_approved',
                            level: 'LEVEL_1',
                            newLimits: result.newLimits,
                            timestamp: new Date().toISOString()
                        }
                    });
                } catch (notifError) {
                    console.error('Error sending KYC notification:', notifError);
                }
            }

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Error processing KYC Level 1:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/kyc/level2
 * Inicia verificação KYC Nível 2 (documentos + biometria)
 */
router.post('/level2',
    [
        body('userId').notEmpty().withMessage('User ID is required'),
        body('documentType').isIn(['RG', 'CNH', 'PASSPORT']).withMessage('Tipo de documento inválido'),
        body('documentImages').isArray({ min: 1 }).withMessage('Pelo menos uma imagem do documento é necessária'),
        body('selfieImage').notEmpty().withMessage('Selfie é obrigatória'),
        body('comprovanteResidencia').optional().isString(),
        body('provider').optional().isIn(['JUMIO', 'SUMSUB', 'SERPRO']),
        body('ipAddress').optional().isIP(),
        body('userAgent').optional().isString()
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const {
                userId,
                documentType,
                documentImages,
                selfieImage,
                comprovanteResidencia,
                provider = 'JUMIO',
                ipAddress,
                userAgent
            } = req.body;

            // Verificar se o userId corresponde ao usuário autenticado
            if (userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            // Validar tamanho das imagens (base64)
            const maxImageSize = 10 * 1024 * 1024; // 10MB em base64
            
            for (const image of documentImages) {
                if (image.length > maxImageSize) {
                    return res.status(400).json({
                        success: false,
                        error: 'Imagem do documento muito grande (máximo 10MB)'
                    });
                }
            }

            if (selfieImage.length > maxImageSize) {
                return res.status(400).json({
                    success: false,
                    error: 'Selfie muito grande (máximo 10MB)'
                });
            }

            const result = await kycService.initiateKYCLevel2(userId, {
                documentType,
                documentImages,
                selfieImage,
                comprovanteResidencia,
                provider,
                ipAddress: ipAddress || req.ip,
                userAgent: userAgent || req.get('User-Agent')
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Enviar notificação de confirmação
            try {
                await notificationService.sendNotification(userId, {
                    title: '📄 Documentos Recebidos',
                    body: `Seus documentos estão sendo analisados. Resultado em ${result.estimatedProcessingTime}.`,
                    icon: '/icons/documents.png',
                    data: {
                        type: 'kyc_documents_received',
                        level: 'LEVEL_2',
                        sessionId: result.sessionId,
                        estimatedTime: result.estimatedProcessingTime,
                        timestamp: new Date().toISOString()
                    }
                });
            } catch (notifError) {
                console.error('Error sending KYC notification:', notifError);
            }

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Error processing KYC Level 2:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/kyc/level3
 * Inicia verificação KYC Nível 3 (renda + fonte de recursos)
 */
router.post('/level3',
    [
        body('userId').notEmpty().withMessage('User ID is required'),
        body('rendaMensal').isNumeric().withMessage('Renda mensal deve ser numérica'),
        body('fonteRenda').isIn(['salario', 'autonomo', 'empresario', 'investimentos', 'aposentadoria', 'outros']).withMessage('Fonte de renda inválida'),
        body('declaracaoFonteRecursos').isLength({ min: 50 }).withMessage('Declaração deve ter pelo menos 50 caracteres'),
        body('patrimonioDeclarado').optional().isNumeric(),
        body('possuiEmpresa').isBoolean().withMessage('Campo possui empresa deve ser verdadeiro ou falso'),
        body('dadosEmpresa').optional().isObject(),
        body('ipAddress').optional().isIP(),
        body('userAgent').optional().isString()
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const {
                userId,
                rendaMensal,
                fonteRenda,
                declaracaoFonteRecursos,
                patrimonioDeclarado,
                possuiEmpresa,
                dadosEmpresa,
                ipAddress,
                userAgent
            } = req.body;

            // Verificar se o userId corresponde ao usuário autenticado
            if (userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            // Validações adicionais
            const renda = parseFloat(rendaMensal);
            if (renda < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Renda mensal não pode ser negativa'
                });
            }

            // Se possui empresa, validar dados da empresa
            if (possuiEmpresa && (!dadosEmpresa || !dadosEmpresa.cnpj || !dadosEmpresa.razaoSocial)) {
                return res.status(400).json({
                    success: false,
                    error: 'Dados da empresa são obrigatórios quando possui empresa'
                });
            }

            const result = await kycService.initiateKYCLevel3(userId, {
                rendaMensal: renda,
                fonteRenda,
                declaracaoFonteRecursos,
                patrimonioDeclarado: patrimonioDeclarado ? parseFloat(patrimonioDeclarado) : 0,
                possuiEmpresa,
                dadosEmpresa,
                ipAddress: ipAddress || req.ip,
                userAgent: userAgent || req.get('User-Agent')
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Enviar notificação de confirmação
            try {
                await notificationService.sendNotification(userId, {
                    title: '💰 Verificação Financeira Iniciada',
                    body: `Seus dados financeiros estão sendo analisados. Resultado em ${result.estimatedProcessingTime}.`,
                    icon: '/icons/financial.png',
                    data: {
                        type: 'kyc_financial_review',
                        level: 'LEVEL_3',
                        riskScore: result.riskAssessment?.score,
                        estimatedTime: result.estimatedProcessingTime,
                        timestamp: new Date().toISOString()
                    }
                });
            } catch (notifError) {
                console.error('Error sending KYC notification:', notifError);
            }

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Error processing KYC Level 3:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * PUT /api/kyc/status
 * Atualiza status KYC (uso interno/admin)
 */
router.put('/status',
    [
        body('userId').notEmpty().withMessage('User ID is required'),
        body('newStatus').isIn(['pending', 'under_review', 'verified', 'rejected', 'expired', 'suspended']).withMessage('Status inválido'),
        body('reason').optional().isString(),
        body('notes').optional().isArray()
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const { userId, newStatus, reason, notes } = req.body;

            // Verificar permissões (mock admin check)
            if (!req.user.id.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied - admin required'
                });
            }

            const result = await kycService.updateKYCStatus(userId, newStatus, {
                reason,
                notes: notes || [],
                updatedBy: req.user.id,
                method: 'manual_admin_update'
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Enviar notificação ao usuário sobre mudança de status
            try {
                let notificationData = {};
                
                if (newStatus === 'verified') {
                    notificationData = {
                        title: '✅ Verificação Aprovada!',
                        body: `Sua verificação ${result.level} foi aprovada. Novos limites disponíveis!`,
                        icon: '/icons/approved.png'
                    };
                } else if (newStatus === 'rejected') {
                    notificationData = {
                        title: '❌ Verificação Rejeitada',
                        body: 'Sua verificação foi rejeitada. Entre em contato para mais informações.',
                        icon: '/icons/rejected.png'
                    };
                } else if (newStatus === 'under_review') {
                    notificationData = {
                        title: '🔍 Em Análise',
                        body: 'Sua verificação está sendo analisada por nossa equipe.',
                        icon: '/icons/review.png'
                    };
                }

                if (notificationData.title) {
                    await notificationService.sendNotification(userId, {
                        ...notificationData,
                        data: {
                            type: 'kyc_status_update',
                            level: result.level,
                            newStatus,
                            reason,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
            } catch (notifError) {
                console.error('Error sending status notification:', notifError);
            }

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Error updating KYC status:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/kyc/limits
 * Obtém limites baseados no nível KYC
 */
router.get('/limits',
    [
        query('level').optional().isIn(['NONE', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3'])
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const requestedLevel = req.query.level;

            if (requestedLevel) {
                // Retornar limites para nível específico
                const limits = kycService.getKYCLimits(requestedLevel);
                res.json({
                    success: true,
                    data: {
                        level: requestedLevel,
                        limits
                    }
                });
            } else {
                // Retornar limites atuais do usuário com estatísticas
                const limitStats = await limitService.getUserLimitStats(userId);
                
                if (!limitStats.success) {
                    return res.status(400).json(limitStats);
                }

                res.json({
                    success: true,
                    data: limitStats.data
                });
            }

        } catch (error) {
            console.error('Error getting KYC limits:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/kyc/requirements/:level
 * Obtém requisitos para um nível KYC específico
 */
router.get('/requirements/:level',
    [
        param('level').isIn(['LEVEL_1', 'LEVEL_2', 'LEVEL_3']).withMessage('Nível KYC inválido')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const level = req.params.level;
            const levelConfig = kycService.getKYCLimits(level);

            const requirements = {
                LEVEL_1: {
                    documents: [
                        'Nome completo',
                        'CPF',
                        'Data de nascimento',
                        'Telefone',
                        'Email',
                        'Endereço completo'
                    ],
                    estimatedTime: '5-10 minutos',
                    description: 'Verificação básica com dados pessoais'
                },
                LEVEL_2: {
                    documents: [
                        'Documento oficial com foto (RG, CNH ou Passaporte)',
                        'Selfie segurando o documento',
                        'Comprovante de residência (últimos 3 meses)'
                    ],
                    estimatedTime: '10-30 minutos',
                    description: 'Verificação completa com documentos e biometria',
                    prerequisites: ['Nível 1 aprovado']
                },
                LEVEL_3: {
                    documents: [
                        'Comprovante de renda',
                        'Declaração de fonte de recursos',
                        'Dados da empresa (se aplicável)',
                        'Comprovante de patrimônio (opcional)'
                    ],
                    estimatedTime: '1-3 dias úteis',
                    description: 'Verificação financeira para altos valores',
                    prerequisites: ['Nível 2 aprovado']
                }
            };

            res.json({
                success: true,
                data: {
                    level,
                    name: levelConfig.name,
                    limits: levelConfig.limits,
                    requirements: requirements[level]
                }
            });

        } catch (error) {
            console.error('Error getting KYC requirements:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * POST /api/kyc/check-limit
 * Verifica se uma transação está dentro dos limites
 */
router.post('/check-limit',
    [
        body('transactionAmount').isNumeric().withMessage('Valor da transação deve ser numérico'),
        body('transactionType').isIn(['deposit', 'swap', 'withdrawal', 'bill_payment', 'p2p_transfer']).withMessage('Tipo de transação inválido'),
        body('metadata').optional().isObject()
    ],
    handleValidationErrors,
    authenticateUser,
    async (req, res) => {
        try {
            const { transactionAmount, transactionType, metadata = {} } = req.body;
            const userId = req.user.id;

            const amount = parseFloat(transactionAmount);
            if (amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valor da transação deve ser maior que zero'
                });
            }

            const result = await limitService.checkTransactionLimit(
                userId,
                amount,
                transactionType,
                {
                    ...metadata,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                }
            );

            res.json(result);

        } catch (error) {
            console.error('Error checking transaction limit:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

/**
 * GET /api/kyc/metrics
 * Obtém métricas do sistema KYC (admin)
 */
router.get('/metrics',
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

            const kycMetrics = kycService.getKYCMetrics();
            const limitMetrics = limitService.getLimitMetrics();

            res.json({
                success: true,
                data: {
                    kyc: kycMetrics,
                    limits: limitMetrics,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error getting KYC metrics:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

module.exports = router; 