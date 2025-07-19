const crypto = require('crypto');
const winston = require('winston');

/**
 * KYCService - Gerencia verificação de identidade escalonada (KYC/AML)
 * 
 * Níveis de KYC:
 * - Nenhum: Usuário não verificado (limites muito baixos)
 * - Nível 1: Verificação básica (nome, CPF, data nascimento)
 * - Nível 2: Verificação completa (documentos + prova de vida)
 * - Nível 3: Verificação premium (renda, fonte de recursos)
 * 
 * Conformidade:
 * - LGPD (Lei Geral de Proteção de Dados)
 * - Resolução BCB nº 4.658/2018 (arranjos de pagamento)
 * - Circular BCB nº 3.978/2020 (prevenção à lavagem de dinheiro)
 */
class KYCService {
    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/kyc.log' }),
                new winston.transports.Console()
            ]
        });

        // Configuração de níveis KYC e requisitos
        this.kycLevels = {
            NONE: {
                level: 0,
                name: 'Nenhum',
                description: 'Usuário não verificado',
                requirements: [],
                dailyLimit: 250,      // R$ 250/dia
                weeklyLimit: 1000,    // R$ 1.000/semana
                monthlyLimit: 3000,   // R$ 3.000/mês
                annualLimit: 12000    // R$ 12.000/ano
            },
            LEVEL_1: {
                level: 1,
                name: 'Nível 1',
                description: 'Verificação básica (dados pessoais)',
                requirements: ['nome_completo', 'cpf', 'data_nascimento', 'telefone', 'email'],
                dailyLimit: 2500,     // R$ 2.500/dia
                weeklyLimit: 10000,   // R$ 10.000/semana
                monthlyLimit: 30000,  // R$ 30.000/mês
                annualLimit: 120000   // R$ 120.000/ano
            },
            LEVEL_2: {
                level: 2,
                name: 'Nível 2',
                description: 'Verificação completa (documentos + biometria)',
                requirements: ['level_1', 'documento_foto', 'selfie', 'comprovante_residencia'],
                dailyLimit: 25000,    // R$ 25.000/dia
                weeklyLimit: 100000,  // R$ 100.000/semana
                monthlyLimit: 300000, // R$ 300.000/mês
                annualLimit: 1200000  // R$ 1.200.000/ano
            },
            LEVEL_3: {
                level: 3,
                name: 'Nível 3',
                description: 'Verificação premium (renda + fonte recursos)',
                requirements: ['level_2', 'comprovante_renda', 'declaracao_fonte_recursos'],
                dailyLimit: 100000,   // R$ 100.000/dia
                weeklyLimit: 500000,  // R$ 500.000/semana
                monthlyLimit: 1500000, // R$ 1.500.000/mês
                annualLimit: 6000000  // R$ 6.000.000/ano
            }
        };

        // Status de verificação possíveis
        this.verificationStatus = {
            NOT_STARTED: 'not_started',
            PENDING: 'pending',
            UNDER_REVIEW: 'under_review',
            VERIFIED: 'verified',
            REJECTED: 'rejected',
            EXPIRED: 'expired',
            SUSPENDED: 'suspended'
        };

        // Provedores de IDV externos (para integração futura)
        this.idvProviders = {
            JUMIO: {
                name: 'Jumio',
                apiUrl: process.env.JUMIO_API_URL,
                apiKey: process.env.JUMIO_API_KEY,
                capabilities: ['document_verification', 'biometric_verification', 'liveness_check']
            },
            SUMSUB: {
                name: 'Sum&Substance',
                apiUrl: process.env.SUMSUB_API_URL,
                apiKey: process.env.SUMSUB_API_KEY,
                capabilities: ['document_verification', 'facial_recognition', 'aml_screening']
            },
            SERPRO: {
                name: 'Serpro (CPF Validation)',
                apiUrl: process.env.SERPRO_API_URL,
                apiKey: process.env.SERPRO_API_KEY,
                capabilities: ['cpf_validation', 'name_validation']
            }
        };

        // Storage em memória para MVP - substituir por banco de dados criptografado
        this.userKYCData = new Map(); // userId -> { level, status, data, verificationHistory }
        this.verificationSessions = new Map(); // sessionId -> { userId, level, provider, status }

        this.logger.info('KYCService initialized with compliance framework');
    }

    /**
     * Verifica o status KYC atual de um usuário
     * @param {string} userId - ID do usuário
     * @returns {Object} - Status KYC atual
     */
    async checkUserKYCStatus(userId) {
        try {
            const userData = this.userKYCData.get(userId) || {
                level: 'NONE',
                status: this.verificationStatus.NOT_STARTED,
                data: {},
                verificationHistory: [],
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };

            const levelConfig = this.kycLevels[userData.level];
            
            // Verificar se a verificação expirou (válida por 2 anos)
            if (userData.status === this.verificationStatus.VERIFIED) {
                const verifiedAt = new Date(userData.lastUpdated);
                const expirationDate = new Date(verifiedAt.getTime() + (2 * 365 * 24 * 60 * 60 * 1000));
                
                if (new Date() > expirationDate) {
                    userData.status = this.verificationStatus.EXPIRED;
                    this.userKYCData.set(userId, userData);
                }
            }

            return {
                success: true,
                userId,
                currentLevel: userData.level,
                levelName: levelConfig.name,
                status: userData.status,
                limits: {
                    daily: levelConfig.dailyLimit,
                    weekly: levelConfig.weeklyLimit,
                    monthly: levelConfig.monthlyLimit,
                    annual: levelConfig.annualLimit
                },
                canUpgrade: this.canUpgradeToNextLevel(userData.level, userData.status),
                nextLevel: this.getNextAvailableLevel(userData.level),
                verifiedAt: userData.verifiedAt || null,
                expiresAt: userData.verifiedAt ? 
                    new Date(new Date(userData.verifiedAt).getTime() + (2 * 365 * 24 * 60 * 60 * 1000)).toISOString() : null
            };

        } catch (error) {
            this.logger.error('Error checking KYC status', {
                userId,
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: 'Failed to check KYC status'
            };
        }
    }

    /**
     * Inicia verificação KYC Nível 1 (dados básicos)
     * @param {string} userId - ID do usuário
     * @param {Object} userData - Dados básicos do usuário
     * @returns {Promise<Object>} - Resultado da iniciação
     */
    async initiateKYCLevel1(userId, userData) {
        try {
            const {
                nomeCompleto,
                cpf,
                dataNascimento,
                telefone,
                email,
                endereco
            } = userData;

            // Validações básicas
            const validation = await this.validateLevel1Data({
                nomeCompleto,
                cpf,
                dataNascimento,
                telefone,
                email,
                endereco
            });

            if (!validation.isValid) {
                return {
                    success: false,
                    error: 'Dados inválidos',
                    validationErrors: validation.errors
                };
            }

            // Verificar se CPF já está em uso
            const cpfInUse = await this.checkCPFInUse(cpf, userId);
            if (cpfInUse) {
                return {
                    success: false,
                    error: 'CPF já cadastrado no sistema'
                };
            }

            // Validar CPF com Serpro (simulado para MVP)
            const cpfValidation = await this.validateCPFWithSerpro(cpf, nomeCompleto);
            
            let status = this.verificationStatus.PENDING;
            let verificationNotes = [];

            if (cpfValidation.success) {
                if (cpfValidation.nameMatch) {
                    status = this.verificationStatus.VERIFIED;
                } else {
                    status = this.verificationStatus.UNDER_REVIEW;
                    verificationNotes.push('Nome não confere com CPF - revisão manual necessária');
                }
            } else {
                status = this.verificationStatus.UNDER_REVIEW;
                verificationNotes.push('CPF não pôde ser validado automaticamente');
            }

            // Salvar dados KYC (criptografados em produção)
            const kycData = {
                level: 'LEVEL_1',
                status,
                data: {
                    nomeCompleto: this.encryptSensitiveData(nomeCompleto),
                    cpf: this.encryptSensitiveData(cpf),
                    dataNascimento: this.encryptSensitiveData(dataNascimento),
                    telefone: this.encryptSensitiveData(telefone),
                    email: this.encryptSensitiveData(email),
                    endereco: this.encryptSensitiveData(JSON.stringify(endereco))
                },
                verificationHistory: [{
                    level: 'LEVEL_1',
                    status,
                    timestamp: new Date().toISOString(),
                    method: 'automated_cpf_validation',
                    notes: verificationNotes,
                    ipAddress: userData.ipAddress,
                    userAgent: userData.userAgent
                }],
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                ...(status === this.verificationStatus.VERIFIED && { verifiedAt: new Date().toISOString() })
            };

            this.userKYCData.set(userId, kycData);

            this.logger.info('KYC Level 1 initiated', {
                userId,
                status,
                cpfValidated: cpfValidation.success,
                nameMatch: cpfValidation.nameMatch
            });

            return {
                success: true,
                level: 'LEVEL_1',
                status,
                message: status === this.verificationStatus.VERIFIED ? 
                    'Verificação Nível 1 concluída com sucesso' : 
                    'Verificação Nível 1 iniciada - aguardando revisão',
                verificationNotes,
                nextSteps: status === this.verificationStatus.VERIFIED ? 
                    ['Você pode agora realizar transações com limites ampliados'] :
                    ['Aguarde a revisão dos seus dados', 'Você será notificado sobre o resultado'],
                newLimits: this.kycLevels.LEVEL_1
            };

        } catch (error) {
            this.logger.error('Error initiating KYC Level 1', {
                userId,
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: 'Falha ao iniciar verificação Nível 1'
            };
        }
    }

    /**
     * Inicia verificação KYC Nível 2 (documentos + biometria)
     * @param {string} userId - ID do usuário
     * @param {Object} documentData - Dados de documentos
     * @returns {Promise<Object>} - Resultado da iniciação
     */
    async initiateKYCLevel2(userId, documentData) {
        try {
            // Verificar se usuário tem Nível 1 aprovado
            const currentStatus = await this.checkUserKYCStatus(userId);
            
            if (!currentStatus.success || currentStatus.currentLevel !== 'LEVEL_1' || 
                currentStatus.status !== this.verificationStatus.VERIFIED) {
                return {
                    success: false,
                    error: 'Nível 1 deve estar aprovado antes de iniciar Nível 2'
                };
            }

            const {
                documentType, // 'RG', 'CNH', 'PASSPORT'
                documentImages, // Array de imagens base64
                selfieImage, // Selfie base64
                comprovanteResidencia, // Imagem base64
                provider = 'JUMIO' // Provedor IDV preferido
            } = documentData;

            // Validações básicas
            if (!documentType || !documentImages || !selfieImage) {
                return {
                    success: false,
                    error: 'Documentos obrigatórios não fornecidos',
                    required: ['documentType', 'documentImages', 'selfieImage']
                };
            }

            // Criar sessão de verificação com provedor externo
            const verificationSession = await this.createIDVSession(userId, provider, {
                documentType,
                documentImages,
                selfieImage,
                comprovanteResidencia
            });

            if (!verificationSession.success) {
                return {
                    success: false,
                    error: 'Falha ao iniciar verificação com provedor externo',
                    details: verificationSession.error
                };
            }

            // Atualizar dados KYC
            const userData = this.userKYCData.get(userId);
            userData.level = 'LEVEL_2';
            userData.status = this.verificationStatus.UNDER_REVIEW;
            userData.data.level2 = {
                documentType: this.encryptSensitiveData(documentType),
                verificationSessionId: verificationSession.sessionId,
                provider,
                submittedAt: new Date().toISOString()
            };
            
            userData.verificationHistory.push({
                level: 'LEVEL_2',
                status: this.verificationStatus.UNDER_REVIEW,
                timestamp: new Date().toISOString(),
                method: `external_idv_${provider.toLowerCase()}`,
                sessionId: verificationSession.sessionId,
                notes: ['Documentos enviados para verificação externa'],
                ipAddress: documentData.ipAddress,
                userAgent: documentData.userAgent
            });

            userData.lastUpdated = new Date().toISOString();
            this.userKYCData.set(userId, userData);

            this.logger.info('KYC Level 2 initiated', {
                userId,
                provider,
                sessionId: verificationSession.sessionId,
                documentType
            });

            return {
                success: true,
                level: 'LEVEL_2',
                status: this.verificationStatus.UNDER_REVIEW,
                sessionId: verificationSession.sessionId,
                message: 'Documentos enviados para verificação',
                estimatedProcessingTime: '2-5 minutos',
                nextSteps: [
                    'Seus documentos estão sendo analisados',
                    'Você receberá uma notificação com o resultado',
                    'O processo pode levar até 24 horas em casos complexos'
                ],
                trackingUrl: verificationSession.trackingUrl
            };

        } catch (error) {
            this.logger.error('Error initiating KYC Level 2', {
                userId,
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: 'Falha ao iniciar verificação Nível 2'
            };
        }
    }

    /**
     * Inicia verificação KYC Nível 3 (renda + fonte de recursos)
     * @param {string} userId - ID do usuário
     * @param {Object} financialData - Dados financeiros
     * @returns {Promise<Object>} - Resultado da iniciação
     */
    async initiateKYCLevel3(userId, financialData) {
        try {
            // Verificar se usuário tem Nível 2 aprovado
            const currentStatus = await this.checkUserKYCStatus(userId);
            
            if (!currentStatus.success || currentStatus.currentLevel !== 'LEVEL_2' || 
                currentStatus.status !== this.verificationStatus.VERIFIED) {
                return {
                    success: false,
                    error: 'Nível 2 deve estar aprovado antes de iniciar Nível 3'
                };
            }

            const {
                rendaMensal,
                fonteRenda, // 'salario', 'autonomo', 'empresario', 'investimentos', 'outros'
                comprovanteRenda, // Array de imagens base64
                declaracaoFonteRecursos, // Texto explicativo
                patrimonioDeclarado,
                possuiEmpresa,
                dadosEmpresa // Se aplicável
            } = financialData;

            // Validações básicas
            if (!rendaMensal || !fonteRenda || !comprovanteRenda || !declaracaoFonteRecursos) {
                return {
                    success: false,
                    error: 'Dados financeiros obrigatórios não fornecidos'
                };
            }

            // Validar compatibilidade de renda com histórico de transações
            const riskAssessment = await this.assessFinancialRisk(userId, {
                rendaMensal,
                fonteRenda,
                patrimonioDeclarado
            });

            let status = this.verificationStatus.UNDER_REVIEW;
            let verificationNotes = [];

            // Análise automática de risco
            if (riskAssessment.riskScore > 80) {
                verificationNotes.push('Alto risco - revisão manual obrigatória');
            } else if (riskAssessment.riskScore > 50) {
                verificationNotes.push('Risco médio - verificação adicional necessária');
            }

            // Atualizar dados KYC
            const userData = this.userKYCData.get(userId);
            userData.level = 'LEVEL_3';
            userData.status = status;
            userData.data.level3 = {
                rendaMensal: this.encryptSensitiveData(rendaMensal.toString()),
                fonteRenda: this.encryptSensitiveData(fonteRenda),
                declaracaoFonteRecursos: this.encryptSensitiveData(declaracaoFonteRecursos),
                patrimonioDeclarado: this.encryptSensitiveData(patrimonioDeclarado?.toString() || '0'),
                riskScore: riskAssessment.riskScore,
                submittedAt: new Date().toISOString()
            };

            userData.verificationHistory.push({
                level: 'LEVEL_3',
                status,
                timestamp: new Date().toISOString(),
                method: 'financial_analysis',
                riskScore: riskAssessment.riskScore,
                notes: verificationNotes,
                ipAddress: financialData.ipAddress,
                userAgent: financialData.userAgent
            });

            userData.lastUpdated = new Date().toISOString();
            this.userKYCData.set(userId, userData);

            this.logger.info('KYC Level 3 initiated', {
                userId,
                rendaMensal,
                fonteRenda,
                riskScore: riskAssessment.riskScore
            });

            return {
                success: true,
                level: 'LEVEL_3',
                status,
                message: 'Verificação financeira iniciada',
                riskAssessment: {
                    score: riskAssessment.riskScore,
                    level: riskAssessment.riskLevel
                },
                estimatedProcessingTime: '1-3 dias úteis',
                nextSteps: [
                    'Seus dados financeiros estão sendo analisados',
                    'Pode ser necessária documentação adicional',
                    'Você será contatado se precisarmos de mais informações'
                ]
            };

        } catch (error) {
            this.logger.error('Error initiating KYC Level 3', {
                userId,
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: 'Falha ao iniciar verificação Nível 3'
            };
        }
    }

    /**
     * Atualiza status de KYC de um usuário
     * @param {string} userId - ID do usuário
     * @param {string} newStatus - Novo status
     * @param {Object} metadata - Metadados da atualização
     * @returns {Promise<Object>} - Resultado da atualização
     */
    async updateKYCStatus(userId, newStatus, metadata = {}) {
        try {
            const userData = this.userKYCData.get(userId);
            
            if (!userData) {
                return {
                    success: false,
                    error: 'Usuário não encontrado'
                };
            }

            const previousStatus = userData.status;
            userData.status = newStatus;
            userData.lastUpdated = new Date().toISOString();

            // Se aprovado, definir data de verificação
            if (newStatus === this.verificationStatus.VERIFIED) {
                userData.verifiedAt = new Date().toISOString();
            }

            // Adicionar ao histórico
            userData.verificationHistory.push({
                level: userData.level,
                status: newStatus,
                previousStatus,
                timestamp: new Date().toISOString(),
                method: metadata.method || 'manual_update',
                notes: metadata.notes || [],
                updatedBy: metadata.updatedBy || 'system',
                reason: metadata.reason
            });

            this.userKYCData.set(userId, userData);

            this.logger.info('KYC status updated', {
                userId,
                level: userData.level,
                previousStatus,
                newStatus,
                updatedBy: metadata.updatedBy
            });

            return {
                success: true,
                userId,
                level: userData.level,
                previousStatus,
                newStatus,
                verifiedAt: userData.verifiedAt,
                limits: this.kycLevels[userData.level]
            };

        } catch (error) {
            this.logger.error('Error updating KYC status', {
                userId,
                newStatus,
                error: error.message
            });

            return {
                success: false,
                error: 'Falha ao atualizar status KYC'
            };
        }
    }

    /**
     * Valida dados do Nível 1
     * @param {Object} data - Dados para validar
     * @returns {Object} - Resultado da validação
     */
    async validateLevel1Data(data) {
        const errors = [];

        // Validar nome completo
        if (!data.nomeCompleto || data.nomeCompleto.length < 5) {
            errors.push('Nome completo deve ter pelo menos 5 caracteres');
        }

        // Validar CPF
        if (!this.isValidCPF(data.cpf)) {
            errors.push('CPF inválido');
        }

        // Validar data de nascimento
        const birthDate = new Date(data.dataNascimento);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        
        if (age < 18) {
            errors.push('Usuário deve ser maior de idade');
        }
        
        if (age > 120) {
            errors.push('Data de nascimento inválida');
        }

        // Validar telefone
        if (!data.telefone || !/^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(data.telefone)) {
            errors.push('Telefone deve estar no formato (11) 99999-9999');
        }

        // Validar email
        if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push('Email inválido');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Valida CPF brasileiro
     * @param {string} cpf - CPF para validar
     * @returns {boolean} - Se é válido
     */
    isValidCPF(cpf) {
        if (!cpf) return false;
        
        // Remove formatação
        cpf = cpf.replace(/[^\d]/g, '');
        
        // Verifica se tem 11 dígitos
        if (cpf.length !== 11) return false;
        
        // Verifica se todos os dígitos são iguais
        if (/^(\d)\1+$/.test(cpf)) return false;
        
        // Validação dos dígitos verificadores
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(cpf.charAt(i)) * (10 - i);
        }
        let digit1 = 11 - (sum % 11);
        if (digit1 > 9) digit1 = 0;
        
        sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += parseInt(cpf.charAt(i)) * (11 - i);
        }
        let digit2 = 11 - (sum % 11);
        if (digit2 > 9) digit2 = 0;
        
        return parseInt(cpf.charAt(9)) === digit1 && parseInt(cpf.charAt(10)) === digit2;
    }

    /**
     * Verifica se CPF já está em uso por outro usuário
     * @param {string} cpf - CPF para verificar
     * @param {string} currentUserId - ID do usuário atual
     * @returns {boolean} - Se está em uso
     */
    async checkCPFInUse(cpf, currentUserId) {
        // Em produção, consultar banco de dados
        for (const [userId, userData] of this.userKYCData) {
            if (userId !== currentUserId && userData.data.cpf) {
                const decryptedCPF = this.decryptSensitiveData(userData.data.cpf);
                if (decryptedCPF === cpf) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Valida CPF com Serpro (simulado para MVP)
     * @param {string} cpf - CPF para validar
     * @param {string} nome - Nome para conferir
     * @returns {Promise<Object>} - Resultado da validação
     */
    async validateCPFWithSerpro(cpf, nome) {
        try {
            // Simulação de validação externa
            // Em produção, fazer chamada real para API do Serpro
            
            this.logger.info('Validating CPF with Serpro', { cpf: cpf.substring(0, 3) + '***' });
            
            // Simular delay de API
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Simular resultado baseado no CPF (para testes)
            const isValid = this.isValidCPF(cpf);
            const nameMatch = nome.length > 5; // Simulação simples
            
            return {
                success: isValid,
                nameMatch,
                cpfStatus: isValid ? 'REGULAR' : 'INVALID',
                lastUpdate: new Date().toISOString()
            };
            
        } catch (error) {
            this.logger.error('Error validating CPF with Serpro', {
                error: error.message
            });
            
            return {
                success: false,
                error: 'Falha na validação externa do CPF'
            };
        }
    }

    /**
     * Cria sessão de verificação com provedor IDV externo (simulado)
     * @param {string} userId - ID do usuário
     * @param {string} provider - Provedor IDV
     * @param {Object} documentData - Dados dos documentos
     * @returns {Promise<Object>} - Resultado da criação
     */
    async createIDVSession(userId, provider, documentData) {
        try {
            const sessionId = crypto.randomBytes(16).toString('hex');
            const providerConfig = this.idvProviders[provider];
            
            if (!providerConfig) {
                return {
                    success: false,
                    error: 'Provedor IDV não suportado'
                };
            }

            // Simular criação de sessão externa
            this.logger.info('Creating IDV session', {
                userId,
                provider,
                sessionId,
                documentType: documentData.documentType
            });

            // Armazenar sessão
            this.verificationSessions.set(sessionId, {
                userId,
                provider,
                status: 'created',
                createdAt: new Date().toISOString(),
                documentType: documentData.documentType
            });

            // Simular processamento assíncrono
            setTimeout(() => {
                this.processIDVSession(sessionId);
            }, 30000); // 30 segundos

            return {
                success: true,
                sessionId,
                provider,
                trackingUrl: `https://${provider.toLowerCase()}.com/session/${sessionId}`,
                estimatedProcessingTime: '2-5 minutos'
            };

        } catch (error) {
            this.logger.error('Error creating IDV session', {
                userId,
                provider,
                error: error.message
            });

            return {
                success: false,
                error: 'Falha ao criar sessão de verificação'
            };
        }
    }

    /**
     * Processa resultado de sessão IDV (simulado)
     * @param {string} sessionId - ID da sessão
     */
    async processIDVSession(sessionId) {
        try {
            const session = this.verificationSessions.get(sessionId);
            
            if (!session) {
                return;
            }

            // Simular resultado da verificação
            const verificationResult = {
                success: Math.random() > 0.1, // 90% de sucesso
                documentVerified: Math.random() > 0.05,
                biometricMatch: Math.random() > 0.05,
                confidence: Math.random() * 0.3 + 0.7, // 70-100%
                riskScore: Math.random() * 30, // 0-30 (baixo risco)
                completedAt: new Date().toISOString()
            };

            // Determinar status final
            let finalStatus = this.verificationStatus.VERIFIED;
            
            if (!verificationResult.success || !verificationResult.documentVerified || 
                !verificationResult.biometricMatch || verificationResult.confidence < 0.8) {
                finalStatus = verificationResult.riskScore > 20 ? 
                    this.verificationStatus.REJECTED : 
                    this.verificationStatus.UNDER_REVIEW;
            }

            // Atualizar status KYC do usuário
            await this.updateKYCStatus(session.userId, finalStatus, {
                method: `external_idv_${session.provider.toLowerCase()}`,
                notes: [
                    `Verificação de documento: ${verificationResult.documentVerified ? 'Aprovado' : 'Rejeitado'}`,
                    `Verificação biométrica: ${verificationResult.biometricMatch ? 'Aprovado' : 'Rejeitado'}`,
                    `Confiança: ${(verificationResult.confidence * 100).toFixed(1)}%`,
                    `Score de risco: ${verificationResult.riskScore.toFixed(1)}`
                ],
                sessionId,
                verificationResult
            });

            this.logger.info('IDV session processed', {
                sessionId,
                userId: session.userId,
                finalStatus,
                confidence: verificationResult.confidence
            });

        } catch (error) {
            this.logger.error('Error processing IDV session', {
                sessionId,
                error: error.message
            });
        }
    }

    /**
     * Avalia risco financeiro para Nível 3
     * @param {string} userId - ID do usuário
     * @param {Object} financialData - Dados financeiros
     * @returns {Promise<Object>} - Avaliação de risco
     */
    async assessFinancialRisk(userId, financialData) {
        try {
            let riskScore = 0;
            const factors = [];

            const { rendaMensal, fonteRenda, patrimonioDeclarado } = financialData;

            // Fator 1: Compatibilidade de renda com histórico de transações
            // Em produção, consultar histórico real de transações
            const avgMonthlyTransactions = 5000; // Simulado
            const incomeToTransactionRatio = avgMonthlyTransactions / rendaMensal;
            
            if (incomeToTransactionRatio > 2) {
                riskScore += 30;
                factors.push('Volume de transações alto em relação à renda declarada');
            } else if (incomeToTransactionRatio > 1) {
                riskScore += 15;
                factors.push('Volume de transações moderadamente alto');
            }

            // Fator 2: Fonte de renda
            const riskBySource = {
                'salario': 0,
                'autonomo': 10,
                'empresario': 15,
                'investimentos': 20,
                'outros': 25
            };
            
            riskScore += riskBySource[fonteRenda] || 25;

            // Fator 3: Patrimônio declarado vs renda
            if (patrimonioDeclarado && patrimonioDeclarado > rendaMensal * 100) {
                riskScore += 20;
                factors.push('Patrimônio muito alto em relação à renda');
            }

            // Fator 4: Idade da conta
            const userData = this.userKYCData.get(userId);
            if (userData) {
                const accountAge = Date.now() - new Date(userData.createdAt).getTime();
                const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
                
                if (daysSinceCreation < 7) {
                    riskScore += 25;
                    factors.push('Conta muito recente');
                } else if (daysSinceCreation < 30) {
                    riskScore += 10;
                    factors.push('Conta recente');
                }
            }

            // Determinar nível de risco
            let riskLevel = 'BAIXO';
            if (riskScore > 70) {
                riskLevel = 'ALTO';
            } else if (riskScore > 40) {
                riskLevel = 'MÉDIO';
            }

            return {
                riskScore: Math.min(riskScore, 100),
                riskLevel,
                factors,
                recommendation: riskScore > 70 ? 'REJEITAR' : riskScore > 50 ? 'REVISAR' : 'APROVAR'
            };

        } catch (error) {
            this.logger.error('Error assessing financial risk', {
                userId,
                error: error.message
            });

            return {
                riskScore: 50,
                riskLevel: 'MÉDIO',
                factors: ['Erro na avaliação de risco'],
                recommendation: 'REVISAR'
            };
        }
    }

    /**
     * Verifica se usuário pode fazer upgrade para próximo nível
     * @param {string} currentLevel - Nível atual
     * @param {string} status - Status atual
     * @returns {boolean} - Se pode fazer upgrade
     */
    canUpgradeToNextLevel(currentLevel, status) {
        if (status !== this.verificationStatus.VERIFIED) {
            return false;
        }

        const levelOrder = ['NONE', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3'];
        const currentIndex = levelOrder.indexOf(currentLevel);
        
        return currentIndex < levelOrder.length - 1;
    }

    /**
     * Obtém próximo nível disponível
     * @param {string} currentLevel - Nível atual
     * @returns {string|null} - Próximo nível ou null
     */
    getNextAvailableLevel(currentLevel) {
        const levelOrder = ['NONE', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3'];
        const currentIndex = levelOrder.indexOf(currentLevel);
        
        return currentIndex < levelOrder.length - 1 ? levelOrder[currentIndex + 1] : null;
    }

    /**
     * Criptografa dados sensíveis (placeholder)
     * @param {string} data - Dados para criptografar
     * @returns {string} - Dados criptografados
     */
    encryptSensitiveData(data) {
        // Em produção, usar AES-256-GCM com chaves gerenciadas por HSM/KMS
        const cipher = crypto.createCipher('aes192', process.env.KYC_ENCRYPTION_KEY || 'default-key');
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    /**
     * Descriptografa dados sensíveis (placeholder)
     * @param {string} encryptedData - Dados criptografados
     * @returns {string} - Dados descriptografados
     */
    decryptSensitiveData(encryptedData) {
        try {
            const decipher = crypto.createDecipher('aes192', process.env.KYC_ENCRYPTION_KEY || 'default-key');
            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            this.logger.error('Error decrypting data', { error: error.message });
            return '[ENCRYPTED]';
        }
    }

    /**
     * Obtém configuração de limites por nível KYC
     * @param {string} kycLevel - Nível KYC
     * @returns {Object} - Limites configurados
     */
    getKYCLimits(kycLevel) {
        const levelConfig = this.kycLevels[kycLevel];
        
        if (!levelConfig) {
            return this.kycLevels.NONE;
        }

        return {
            level: levelConfig.level,
            name: levelConfig.name,
            description: levelConfig.description,
            limits: {
                daily: levelConfig.dailyLimit,
                weekly: levelConfig.weeklyLimit,
                monthly: levelConfig.monthlyLimit,
                annual: levelConfig.annualLimit
            },
            requirements: levelConfig.requirements
        };
    }

    /**
     * Obtém métricas do sistema KYC
     * @returns {Object} - Métricas do sistema
     */
    getKYCMetrics() {
        const metrics = {
            totalUsers: this.userKYCData.size,
            byLevel: {
                NONE: 0,
                LEVEL_1: 0,
                LEVEL_2: 0,
                LEVEL_3: 0
            },
            byStatus: {
                [this.verificationStatus.NOT_STARTED]: 0,
                [this.verificationStatus.PENDING]: 0,
                [this.verificationStatus.UNDER_REVIEW]: 0,
                [this.verificationStatus.VERIFIED]: 0,
                [this.verificationStatus.REJECTED]: 0,
                [this.verificationStatus.EXPIRED]: 0
            },
            activeSessions: this.verificationSessions.size
        };

        for (const [userId, userData] of this.userKYCData) {
            metrics.byLevel[userData.level]++;
            metrics.byStatus[userData.status]++;
        }

        return metrics;
    }
}

module.exports = KYCService; 