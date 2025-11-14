const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const winston = require('winston');
const KYCService = require('./KYCService');
const LimitService = require('./LimitService');
const SupabaseService = require('./SupabaseService');

/**
 * AuthService - Gerencia autenticação via Google OAuth e sessões JWT
 * Integrado com KYC/AML para carregamento de limites e status de verificação
 */
class AuthService {
    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/auth.log' }),
                new winston.transports.Console()
            ]
        });

        // Inicializar serviços de compliance
        this.kycService = new KYCService();
        this.limitService = new LimitService(this.kycService);
        this.supabaseService = new SupabaseService();

        // JWT configuration
        this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

        // Google OAuth configuration
        this.googleClientId = process.env.GOOGLE_CLIENT_ID;
        this.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

        // Storage em memória para MVP - substituir por banco de dados
        this.users = new Map(); // userId -> userData
        this.sessions = new Map(); // sessionId -> sessionData
        this.refreshTokens = new Map(); // refreshToken -> userId

        this.logger.info('AuthService initialized with KYC/AML integration');
    }

    /**
     * Processa login via Google OAuth
     * @param {string} googleToken - Token do Google OAuth
     * @param {Object} clientInfo - Informações do cliente (IP, User-Agent, etc.)
     * @returns {Promise<Object>} - Resultado do login
     */
    async loginWithGoogle(googleToken, clientInfo = {}) {
        try {
            // Verificar token do Google (simulado para MVP)
            const googleUserData = await this.verifyGoogleToken(googleToken);
            
            if (!googleUserData.success) {
                return {
                    success: false,
                    error: 'Token do Google inválido'
                };
            }

            const { email, name, picture, googleId } = googleUserData.data;
            
            // Buscar ou criar usuário
            let user = this.findUserByEmail(email);
            let isNewUser = false;

            if (!user) {
                // Criar novo usuário
                user = await this.createUser({
                    email,
                    name,
                    picture,
                    googleId,
                    createdAt: new Date().toISOString()
                }, clientInfo);
                isNewUser = true;
            } else {
                // Atualizar dados do usuário existente
                user.lastLogin = new Date().toISOString();
                user.picture = picture; // Atualizar foto de perfil
                
                if (clientInfo.ipAddress) {
                    user.lastKnownIP = clientInfo.ipAddress;
                }
            }

            // Carregar status KYC e limites
            const kycStatus = await this.kycService.checkUserKYCStatus(user.id);
            const limitStats = await this.limitService.getUserLimitStats(user.id);

            // Gerar tokens JWT
            const sessionData = await this.createSession(user, clientInfo, {
                kyc: kycStatus.success ? kycStatus : null,
                limits: limitStats.success ? limitStats.data : null
            });

            // Salvar usuário atualizado
            this.users.set(user.id, user);

            this.logger.info('User logged in successfully', {
                userId: user.id,
                email: user.email,
                isNewUser,
                kycLevel: kycStatus.success ? kycStatus.currentLevel : 'UNKNOWN',
                ipAddress: clientInfo.ipAddress
            });

            // Preparar resposta
            const response = {
                success: true,
                isNewUser,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    picture: user.picture,
                    createdAt: user.createdAt,
                    lastLogin: user.lastLogin
                },
                tokens: {
                    accessToken: sessionData.accessToken,
                    refreshToken: sessionData.refreshToken,
                    expiresIn: sessionData.expiresIn
                },
                compliance: {
                    kycStatus: kycStatus.success ? {
                        level: kycStatus.currentLevel,
                        levelName: kycStatus.levelName,
                        status: kycStatus.status,
                        canUpgrade: kycStatus.canUpgrade,
                        nextLevel: kycStatus.nextLevel,
                        verifiedAt: kycStatus.verifiedAt,
                        expiresAt: kycStatus.expiresAt
                    } : null,
                    limits: limitStats.success ? limitStats.data : null
                }
            };

            // Se usuário novo, incluir informações de onboarding
            if (isNewUser) {
                response.onboarding = {
                    kycRequired: true,
                    recommendedLevel: 'LEVEL_1',
                    estimatedTime: '5-10 minutos',
                    benefits: [
                        'Limites de transação ampliados',
                        'Acesso a todas as funcionalidades',
                        'Maior segurança da conta'
                    ]
                };
            }

            // Se KYC está expirado ou rejeitado, incluir alertas
            if (kycStatus.success && 
                (kycStatus.status === 'expired' || kycStatus.status === 'rejected')) {
                response.alerts = [{
                    type: 'kyc_action_required',
                    severity: 'warning',
                    message: kycStatus.status === 'expired' ? 
                        'Sua verificação de identidade expirou' :
                        'Sua verificação de identidade foi rejeitada',
                    action: 'Renovar verificação',
                    actionUrl: '/kyc/renew'
                }];
            }

            return response;

        } catch (error) {
            this.logger.error('Error during Google login', {
                error: error.message,
                stack: error.stack,
                clientInfo
            });

            return {
                success: false,
                error: 'Erro interno durante autenticação'
            };
        }
    }

    /**
     * Compatibilidade com rotas: authenticateWithGoogle
     * Empacota loginWithGoogle para retornar { user, accessToken, sessionId }
     */
    async authenticateWithGoogle(googleToken) {
        const result = await this.loginWithGoogle(googleToken, {});
        if (!result.success) {
            return result;
        }
        const accessToken = result.tokens?.accessToken;
        let sessionId = null;
        try {
            const decoded = jwt.verify(accessToken, this.jwtSecret);
            sessionId = decoded.sessionId || null;
        } catch (e) {}
        return {
            success: true,
            user: result.user,
            accessToken,
            sessionId
        };
    }

    /**
     * Cria novo usuário no sistema
     * @param {Object} userData - Dados do usuário
     * @param {Object} clientInfo - Informações do cliente
     * @returns {Promise<Object>} - Usuário criado
     */
    async createUser(userData, clientInfo) {
        const userId = this.generateUserId();
        
        const user = {
            id: userId,
            email: userData.email,
            name: userData.name,
            picture: userData.picture,
            googleId: userData.googleId,
            createdAt: userData.createdAt,
            lastLogin: userData.createdAt,
            isActive: true,
            registrationIP: clientInfo.ipAddress,
            lastKnownIP: clientInfo.ipAddress,
            userAgent: clientInfo.userAgent,
            // Compliance fields
            kycLevel: 'NONE',
            riskScore: 0,
            accountFlags: []
        };

        this.users.set(userId, user);

        // Inicializar estruturas de compliance para novo usuário
        await this.initializeUserCompliance(userId, clientInfo);

        // Persistir perfil do usuário no Supabase
        try {
            await this.supabaseService.upsertUserProfile(user);
        } catch (error) {
            this.logger.error('Erro ao persistir perfil no Supabase', { userId, error: error.message });
        }

        return user;
    }

    /**
     * Inicializa estruturas de compliance para novo usuário
     * @param {string} userId - ID do usuário
     * @param {Object} clientInfo - Informações do cliente
     */
    async initializeUserCompliance(userId, clientInfo) {
        try {
            // Avaliar risco inicial baseado em fatores como IP, horário, etc.
            const initialRiskAssessment = await this.assessInitialRisk(userId, clientInfo);
            
            // Se risco alto, flaggar para revisão
            if (initialRiskAssessment.riskScore > 70) {
                const user = this.users.get(userId);
                user.accountFlags.push({
                    type: 'HIGH_INITIAL_RISK',
                    severity: 'medium',
                    createdAt: new Date().toISOString(),
                    details: initialRiskAssessment.factors
                });
                this.users.set(userId, user);

                this.logger.warn('High risk user registered', {
                    userId,
                    riskScore: initialRiskAssessment.riskScore,
                    factors: initialRiskAssessment.factors
                });
            }

        } catch (error) {
            this.logger.error('Error initializing user compliance', {
                userId,
                error: error.message
            });
        }
    }

    /**
     * Avalia risco inicial de um novo usuário
     * @param {string} userId - ID do usuário
     * @param {Object} clientInfo - Informações do cliente
     * @returns {Promise<Object>} - Avaliação de risco
     */
    async assessInitialRisk(userId, clientInfo) {
        let riskScore = 0;
        const factors = [];

        // Fator 1: IP suspeito
        if (clientInfo.ipAddress) {
            if (this.isHighRiskIP(clientInfo.ipAddress)) {
                riskScore += 30;
                factors.push('IP de alto risco');
            }

            // Verificar se IP já foi usado por muitos usuários
            const ipUsageCount = this.getIPUsageCount(clientInfo.ipAddress);
            if (ipUsageCount > 5) {
                riskScore += 20;
                factors.push('IP usado por múltiplos usuários');
            }
        }

        // Fator 2: Horário de registro
        const hour = new Date().getHours();
        if (hour < 6 || hour > 23) {
            riskScore += 15;
            factors.push('Registro em horário atípico');
        }

        // Fator 3: User-Agent suspeito
        if (clientInfo.userAgent) {
            if (this.isSuspiciousUserAgent(clientInfo.userAgent)) {
                riskScore += 25;
                factors.push('User-Agent suspeito');
            }
        }

        // Fator 4: Padrão de email
        const user = this.users.get(userId);
        if (user && this.isSuspiciousEmail(user.email)) {
            riskScore += 10;
            factors.push('Padrão de email suspeito');
        }

        return {
            riskScore: Math.min(riskScore, 100),
            factors,
            recommendation: riskScore > 70 ? 'BLOCK' : riskScore > 40 ? 'MONITOR' : 'ALLOW'
        };
    }

    /**
     * Cria sessão de usuário com tokens JWT
     * @param {Object} user - Dados do usuário
     * @param {Object} clientInfo - Informações do cliente
     * @param {Object} complianceData - Dados de compliance
     * @returns {Promise<Object>} - Dados da sessão
     */
    async createSession(user, clientInfo, complianceData) {
        const sessionId = this.generateSessionId();
        const refreshToken = this.generateRefreshToken();

        // Payload do JWT
        const jwtPayload = {
            userId: user.id,
            email: user.email,
            sessionId,
            // Incluir dados de compliance no token para acesso rápido
            compliance: {
                kycLevel: complianceData.kyc?.currentLevel || 'NONE',
                kycStatus: complianceData.kyc?.status || 'not_started',
                limits: complianceData.limits?.limits || null
            },
            iat: Math.floor(Date.now() / 1000)
        };

        // Gerar access token
        const accessToken = jwt.sign(jwtPayload, this.jwtSecret, {
            expiresIn: this.jwtExpiresIn
        });

        // Dados da sessão
        const sessionData = {
            sessionId,
            userId: user.id,
            accessToken,
            refreshToken,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(),
            clientInfo,
            complianceData,
            isActive: true
        };

        // Salvar sessão
        this.sessions.set(sessionId, sessionData);
        this.refreshTokens.set(refreshToken, user.id);

        // Persistir sessão no Supabase
        try {
            await this.supabaseService.upsertSession({
                id: sessionId,
                user_id: user.id,
                access_token: accessToken,
                refresh_token: refreshToken,
                created_at: sessionData.createdAt,
                expires_at: sessionData.expiresAt
            });
        } catch (error) {
            this.logger.error('Erro ao persistir sessão no Supabase', { sessionId, error: error.message });
        }

        return {
            accessToken,
            refreshToken,
            sessionId,
            expiresIn: 24 * 60 * 60 // 24 horas em segundos
        };
    }

    /**
     * Verifica e decodifica token JWT
     * @param {string} token - Token JWT
     * @returns {Object} - Dados decodificados ou erro
     */
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            
            // Verificar se sessão ainda está ativa
            const session = this.sessions.get(decoded.sessionId);
            if (!session || !session.isActive) {
                return {
                    success: false,
                    error: 'Sessão inválida ou expirada'
                };
            }

            // Verificar se usuário ainda existe e está ativo
            const user = this.users.get(decoded.userId);
            if (!user || !user.isActive) {
                return {
                    success: false,
                    error: 'Usuário inválido ou inativo'
                };
            }

            return {
                success: true,
                data: {
                    ...decoded,
                    user,
                    session
                }
            };

        } catch (error) {
            return {
                success: false,
                error: 'Token inválido',
                details: error.message
            };
        }
    }

    /**
     * Verifica token de acesso usando Supabase Auth e
     * retorna usuário + payload padronizado para middlewares
     * @param {string} token
     */
    async verifyAccessToken(token) {
        try {
            // Validar com Supabase Auth
            const verification = await this.supabaseService.verifyAccessToken(token);
            if (!verification.valid) {
                // Fallback: aceitar JWT interno emitido por AuthService
                try {
                    const decoded = jwt.verify(token, this.jwtSecret);
                    const user = {
                        id: decoded.userId,
                        email: decoded.email || null,
                        name: null,
                        picture: null,
                        walletAddress: null,
                        createdAt: null,
                        providers: 'google'
                    };
                    return {
                        valid: true,
                        user,
                        payload: {
                            userId: decoded.userId,
                            email: decoded.email || null,
                            sessionId: decoded.sessionId || null,
                        },
                    };
                } catch (e) {
                    return { valid: false, error: verification.error };
                }
            }

            const supaUser = verification.user;

            // Carregar perfil persistido no Supabase (tabela users)
            let profile = null;
            try {
                profile = await this.supabaseService.getUserProfileById(supaUser.id);
            } catch (e) {
                this.logger.warn('Supabase profile fetch failed', { userId: supaUser.id, error: e.message });
            }

            const user = {
                id: supaUser.id,
                email: supaUser.email,
                name: (supaUser.user_metadata && (supaUser.user_metadata.name || supaUser.user_metadata.full_name)) || profile?.name || null,
                picture: (supaUser.user_metadata && (supaUser.user_metadata.avatar_url || supaUser.user_metadata.picture)) || profile?.picture || null,
                walletAddress: profile?.wallet_address || null,
                createdAt: profile?.created_at || null,
                providers: profile?.providers || (profile?.google_id ? 'google' : 'email'),
            };

            // Tentar localizar sessão no Supabase pelo access_token
            let sessionRecord = null;
            try {
                sessionRecord = await this.supabaseService.findSessionByAccessToken(token);
            } catch (e) {
                this.logger.warn('Supabase session lookup failed', { error: e.message });
            }

            let sessionId = sessionRecord?.id || null;
            if (!sessionId) {
                // Persistir uma sessão vinculada ao token
                const newSessionId = this.generateSessionId();
                try {
                    await this.supabaseService.upsertSession({
                        id: newSessionId,
                        user_id: supaUser.id,
                        access_token: token,
                        refresh_token: null,
                        created_at: new Date().toISOString(),
                    });
                    sessionId = newSessionId;
                } catch (e) {
                    this.logger.warn('Supabase session upsert failed', { error: e.message });
                }
            }

            return {
                valid: true,
                user,
                payload: {
                    userId: supaUser.id,
                    email: supaUser.email,
                    sessionId,
                },
            };
        } catch (error) {
            this.logger.error('verifyAccessToken error', { error: error.message });
            return { valid: false, error: 'Token inválido' };
        }
    }

    /**
     * Atualiza dados de compliance no token/sessão
     * @param {string} sessionId - ID da sessão
     * @returns {Promise<Object>} - Token atualizado
     */
    async refreshComplianceData(sessionId) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                return {
                    success: false,
                    error: 'Sessão não encontrada'
                };
            }

            // Recarregar dados de compliance
            const kycStatus = await this.kycService.checkUserKYCStatus(session.userId);
            const limitStats = await this.limitService.getUserLimitStats(session.userId);

            // Atualizar sessão
            session.complianceData = {
                kyc: kycStatus.success ? kycStatus : null,
                limits: limitStats.success ? limitStats.data : null
            };
            session.lastComplianceUpdate = new Date().toISOString();

            this.sessions.set(sessionId, session);

            // Gerar novo access token com dados atualizados
            const user = this.users.get(session.userId);
            const newTokenData = await this.createSession(user, session.clientInfo, session.complianceData);

            return {
                success: true,
                tokens: {
                    accessToken: newTokenData.accessToken,
                    refreshToken: session.refreshToken, // Manter o mesmo refresh token
                    expiresIn: newTokenData.expiresIn
                },
                compliance: session.complianceData
            };

        } catch (error) {
            this.logger.error('Error refreshing compliance data', {
                sessionId,
                error: error.message
            });

            return {
                success: false,
                error: 'Erro ao atualizar dados de compliance'
            };
        }
    }

    /**
     * Verifica token do Google (simulado para MVP)
     * @param {string} googleToken - Token do Google
     * @returns {Promise<Object>} - Dados do usuário do Google
     */
    async verifyGoogleToken(googleToken) {
        try {
            // Em produção, fazer verificação real com Google OAuth API
            // Para MVP, simular dados baseados no token
            
            if (!googleToken || googleToken.length < 10) {
                return {
                    success: false,
                    error: 'Token inválido'
                };
            }

            // Simular dados do Google (em produção, vem da API do Google)
            const mockGoogleData = {
                email: `user${Date.now()}@gmail.com`,
                name: 'Usuário Teste',
                picture: 'https://via.placeholder.com/150',
                googleId: `google_${Date.now()}`,
                emailVerified: true
            };

            return {
                success: true,
                data: mockGoogleData
            };

        } catch (error) {
            this.logger.error('Error verifying Google token', {
                error: error.message
            });

            return {
                success: false,
                error: 'Erro na verificação do token'
            };
        }
    }

    /**
     * Busca usuário por email
     * @param {string} email - Email do usuário
     * @returns {Object|null} - Usuário encontrado ou null
     */
    findUserByEmail(email) {
        for (const [userId, user] of this.users) {
            if (user.email === email) {
                return user;
            }
        }
        return null;
    }

    /**
     * Gera ID único para usuário
     * @returns {string} - ID do usuário
     */
    generateUserId() {
        return 'user_' + crypto.randomBytes(16).toString('hex');
    }

    /**
     * Gera ID único para sessão
     * @returns {string} - ID da sessão
     */
    generateSessionId() {
        return 'session_' + crypto.randomBytes(16).toString('hex');
    }

    /**
     * Gera refresh token
     * @returns {string} - Refresh token
     */
    generateRefreshToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Verifica se IP é de alto risco
     * @param {string} ipAddress - Endereço IP
     * @returns {boolean} - Se é alto risco
     */
    isHighRiskIP(ipAddress) {
        // Lista básica de padrões de IP de alto risco
        const highRiskPatterns = [
            /^10\./, // IPs privados
            /^192\.168\./, // IPs privados
            /^172\.16\./, // IPs privados
            /^127\./, // Localhost
        ];

        return highRiskPatterns.some(pattern => pattern.test(ipAddress));
    }

    /**
     * Conta quantos usuários usaram um IP
     * @param {string} ipAddress - Endereço IP
     * @returns {number} - Contagem de usuários
     */
    getIPUsageCount(ipAddress) {
        let count = 0;
        for (const [userId, user] of this.users) {
            if (user.registrationIP === ipAddress || user.lastKnownIP === ipAddress) {
                count++;
            }
        }
        return count;
    }

    /**
     * Verifica se User-Agent é suspeito
     * @param {string} userAgent - User-Agent string
     * @returns {boolean} - Se é suspeito
     */
    isSuspiciousUserAgent(userAgent) {
        const suspiciousPatterns = [
            /bot/i,
            /crawler/i,
            /spider/i,
            /curl/i,
            /wget/i,
            /python/i
        ];

        return suspiciousPatterns.some(pattern => pattern.test(userAgent));
    }

    /**
     * Verifica se email tem padrão suspeito
     * @param {string} email - Email para verificar
     * @returns {boolean} - Se é suspeito
     */
    isSuspiciousEmail(email) {
        const suspiciousPatterns = [
            /\d{10,}/, // Muitos números seguidos
            /temp/i,
            /test/i,
            /fake/i,
            /\+\d+@/ // Múltiplos aliases
        ];

        return suspiciousPatterns.some(pattern => pattern.test(email));
    }

    /**
     * Obtém perfil completo do usuário incluindo compliance
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Perfil completo
     */
    async getUserProfile(userId) {
        try {
            const user = this.users.get(userId);
            if (!user) {
                return {
                    success: false,
                    error: 'Usuário não encontrado'
                };
            }

            // Carregar dados atualizados de compliance
            const kycStatus = await this.kycService.checkUserKYCStatus(userId);
            const limitStats = await this.limitService.getUserLimitStats(userId);

            return {
                success: true,
                profile: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    picture: user.picture,
                    createdAt: user.createdAt,
                    lastLogin: user.lastLogin,
                    isActive: user.isActive
                },
                compliance: {
                    kyc: kycStatus.success ? kycStatus : null,
                    limits: limitStats.success ? limitStats.data : null,
                    riskScore: user.riskScore || 0,
                    accountFlags: user.accountFlags || []
                }
            };

        } catch (error) {
            this.logger.error('Error getting user profile', {
                userId,
                error: error.message
            });

            return {
                success: false,
                error: 'Erro ao obter perfil do usuário'
            };
        }
    }

    /**
     * Renova o access token usando Supabase Auth e retorna novo par de tokens
     * @param {string} refreshToken - Refresh token atual
     * @returns {Promise<Object>} - { success, accessToken, newRefreshToken, user }
     */
    async refreshAccessToken(refreshToken) {
        try {
            if (!refreshToken) {
                return { success: false, error: 'Refresh token ausente' };
            }

            const session = await this.supabaseService.refreshSession(refreshToken);
            if (!session || !session.access_token) {
                return { success: false, error: 'Falha ao renovar sessão' };
            }

            const accessToken = session.access_token;
            const newRefreshToken = session.refresh_token || refreshToken;

            const verification = await this.supabaseService.verifyAccessToken(accessToken);
            if (!verification.valid) {
                return { success: false, error: verification.error || 'Token inválido após refresh' };
            }

            const supaUser = verification.user;
            let profile = null;
            try {
                profile = await this.supabaseService.getUserProfileById(supaUser.id);
            } catch (e) {
                this.logger.warn('Falha ao obter perfil Supabase no refresh', { userId: supaUser.id, error: e.message });
            }

            try {
                await this.supabaseService.upsertSession({
                    id: verification.payload.sessionId || this.generateSessionId(),
                    user_id: supaUser.id,
                    access_token: accessToken,
                    refresh_token: newRefreshToken,
                    created_at: new Date().toISOString(),
                });
            } catch (e) {
                this.logger.warn('Falha ao atualizar sessão no Supabase (refresh)', { error: e.message });
            }

            const user = {
                id: supaUser.id,
                email: supaUser.email,
                name: (supaUser.user_metadata && (supaUser.user_metadata.name || supaUser.user_metadata.full_name)) || profile?.name || null,
                picture: (supaUser.user_metadata && (supaUser.user_metadata.avatar_url || supaUser.user_metadata.picture)) || profile?.picture || null,
                walletAddress: profile?.wallet_address || null,
                createdAt: profile?.created_at || null,
            };

            let kycStatus = null;
            try {
                const kyc = await this.kycService.checkUserKYCStatus(user.id);
                if (kyc && kyc.success) {
                    kycStatus = kyc;
                }
            } catch (e) {
                this.logger.warn('Falha ao carregar KYC no refresh', { error: e.message });
            }

            return {
                success: true,
                accessToken,
                newRefreshToken,
                user: { ...user, kycStatus },
            };
        } catch (error) {
            this.logger.error('Erro no refreshAccessToken', { error: error.message });
            return { success: false, error: 'Erro ao renovar token' };
        }
    }

    /**
     * Logout do usuário (invalidar sessão)
     * @param {string} sessionId - ID da sessão
     * @returns {Object} - Resultado do logout
     */
    async logout(sessionId) {
        try {
            let session = null;
            try {
                session = await this.supabaseService.getSessionById(sessionId);
            } catch (e) {
                this.logger.warn('Supabase getSessionById falhou', { sessionId, error: e.message });
            }

            if (!session) {
                session = this.sessions.get(sessionId);
            }
            if (!session) {
                return { success: false, error: 'Sessão não encontrada' };
            }

            const userId = session.user_id || session.userId;

            const revoke = await this.supabaseService.invalidateRefreshTokens(userId);
            if (!revoke.success) {
                this.logger.warn('Invalidate refresh tokens não disponível ou falhou', { userId, error: revoke.error });
            }

            try {
                await this.supabaseService.deleteSession(sessionId);
            } catch (e) {
                this.logger.warn('Falha ao deletar sessão no Supabase', { sessionId, error: e.message });
            }

            const memSession = this.sessions.get(sessionId);
            if (memSession) {
                memSession.isActive = false;
                memSession.loggedOutAt = new Date().toISOString();
                this.sessions.set(sessionId, memSession);
                if (memSession.refreshToken) {
                    this.refreshTokens.delete(memSession.refreshToken);
                }
            }

            this.logger.info('User logged out', { userId, sessionId });
            return { success: true, message: 'Logout realizado com sucesso' };
        } catch (error) {
            this.logger.error('Error during logout', { sessionId, error: error.message });
            return { success: false, error: 'Erro durante logout' };
        }
    }
}

module.exports = AuthService;