const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const AuthService = require('../services/AuthService');
const WalletService = require('../services/WalletService');
const FraudDetectionService = require('../services/FraudDetectionService');
const { 
    observabilityMiddleware,
    createLogger,
    createSpan,
    finishSpan,
    addSpanTag,
    addSpanLog
} = require('../middleware/observability');

const router = express.Router();
const authService = new AuthService();
const walletService = new WalletService();
const fraudDetection = new FraudDetectionService();

// Aplicar observabilidade
router.use(observabilityMiddleware());

/**
 * Middleware para validar erros de validação
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array(),
        });
    }
    next();
};

/**
 * Middleware para validar token JWT com verificação de blacklist
 */
const requireAuth = async (req, res, next) => {
    const logger = createLogger(req.correlationId, 'auth-middleware');
    const span = createSpan('auth_verification', req.span);
    
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            finishSpan(span, 'error', new Error('No authorization header'));
            return res.status(401).json({
                success: false,
                error: 'Authorization token required',
            });
        }

        const token = authHeader.substring(7);
        const verification = await authService.verifyAccessToken(token);

        if (!verification.valid) {
            finishSpan(span, 'error', new Error(verification.error));
            return res.status(401).json({
                success: false,
                error: verification.error,
            });
        }

        // Verificar se usuário está blacklistado
        const blacklistCheck = await fraudDetection.getBlacklistService().isBlacklisted(
            'user', 
            verification.user.id,
            req.correlationId
        );

        if (blacklistCheck.isBlacklisted) {
            addSpanTag(span, 'blacklist.hit', true);
            addSpanTag(span, 'blacklist.severity', blacklistCheck.severity);
            
            logger.warn('Blacklisted user attempted access', {
                userId: verification.user.id,
                reason: blacklistCheck.reason,
                severity: blacklistCheck.severity,
                actions: blacklistCheck.actions
            });

            // Se severidade crítica, bloquear completamente
            if (blacklistCheck.severity === 'critical') {
                finishSpan(span, 'blocked', new Error('User blacklisted'));
                return res.status(403).json({
                    success: false,
                    error: 'Access denied',
                    code: 'USER_BLACKLISTED'
                });
            }

            // Para outras severidades, permitir mas marcar para monitoramento
            addSpanTag(span, 'user.flagged', true);
            req.user = {
                ...verification.user,
                isFlagged: true,
                flagReason: blacklistCheck.reason,
                flagSeverity: blacklistCheck.severity
            };
        } else {
            req.user = verification.user;
        }

        req.tokenPayload = verification.payload;
        addSpanTag(span, 'user.id', verification.user.id);
        finishSpan(span, 'success');

        next();
    } catch (error) {
        logger.error('Auth middleware error', {
            error: error.message,
            stack: error.stack
        });

        finishSpan(span, 'error', error);

        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
};

/**
 * POST /api/auth/google-login
 * Autenticação via Google OAuth com verificação de fraudes
 */
router.post('/google-login', [
    body('googleToken')
        .isString()
        .isLength({ min: 1 })
        .withMessage('Google token is required'),
    body('miniKitData')
        .optional()
        .isObject()
        .withMessage('MiniKit data must be an object'),
], handleValidationErrors, async (req, res) => {
    const logger = createLogger(req.correlationId, 'auth-login');
    const span = createSpan('google_login', req.span);
    
    try {
        const { googleToken, miniKitData } = req.body;
        const userAgent = req.get('User-Agent');
        const ipAddress = req.ip;

        addSpanTag(span, 'auth.provider', 'google');
        addSpanTag(span, 'user.ip', ipAddress);
        addSpanTag(span, 'user.agent', userAgent);

        logger.info('Google login attempt', {
            ip: ipAddress,
            userAgent,
            hasMiniKitData: !!miniKitData,
        });

        // 1. Autenticar com Google primeiro
        addSpanLog(span, 'Authenticating with Google');
        const authResult = await authService.authenticateWithGoogle(googleToken);

        if (!authResult.success) {
            finishSpan(span, 'error', new Error(authResult.error));
            return res.status(400).json({
                success: false,
                error: authResult.error,
            });
        }

        const { user, accessToken, sessionId } = authResult;
        addSpanTag(span, 'user.id', user.id);
        addSpanTag(span, 'user.email', user.email);

        // 2. Verificação de blacklist para login
        addSpanLog(span, 'Performing fraud detection for login');
        
        const loginAnalysis = await fraudDetection.analyzeTransaction({
            id: `login_${sessionId}`,
            type: 'login',
            userId: user.id,
            userEmail: user.email,
            userIP: ipAddress,
            amount: 0, // Login não tem valor monetário
            metadata: {
                userAgent,
                provider: 'google',
                miniKitData
            }
        }, req.correlationId);

        addSpanTag(span, 'fraud.risk_score', loginAnalysis.riskScore);
        addSpanTag(span, 'fraud.risk_level', loginAnalysis.riskLevel);
        addSpanTag(span, 'fraud.decision', loginAnalysis.decision);

        // 3. Processar decisão de fraude
        if (loginAnalysis.decision === 'BLOCK') {
            logger.warn('Login blocked due to fraud detection', {
                userId: user.id,
                email: user.email,
                riskScore: loginAnalysis.riskScore,
                reasons: loginAnalysis.reasons,
                ip: ipAddress
            });

            finishSpan(span, 'blocked', new Error('Login blocked by fraud detection'));
            
            return res.status(403).json({
                success: false,
                error: 'Access denied due to security concerns',
                code: 'LOGIN_BLOCKED',
                supportReference: req.correlationId
            });
        }

        if (loginAnalysis.decision === 'REVIEW') {
            logger.warn('Login flagged for review', {
                userId: user.id,
                email: user.email,
                riskScore: loginAnalysis.riskScore,
                reasons: loginAnalysis.reasons,
                ip: ipAddress
            });

            // Permitir login mas marcar usuário como flagged
            user.isFlagged = true;
            user.flagReason = 'Login requires manual review';
            user.reviewRequired = true;
        }

        // 4. Criar carteira custodial se não existir
        let walletAddress = user.walletAddress;
        if (!walletAddress) {
            addSpanLog(span, 'Creating custodial wallet for new user');
            
            logger.info('Creating custodial wallet for new user', {
                userId: user.id,
            });

            const walletResult = await walletService.createWalletForUser(user.id);
            if (walletResult.success) {
                walletAddress = walletResult.wallet.address;
                user.walletAddress = walletAddress;

                // Verificar se endereço da carteira está blacklistado
                const walletCheck = await fraudDetection.getBlacklistService().isBlacklisted(
                    'wallet',
                    walletAddress,
                    req.correlationId
                );

                if (walletCheck.isBlacklisted) {
                    logger.error('Generated wallet address is blacklisted', {
                        userId: user.id,
                        walletAddress,
                        reason: walletCheck.reason
                    });

                    // Regenerar carteira ou bloquear usuário
                    return res.status(500).json({
                        success: false,
                        error: 'Unable to create secure wallet',
                        code: 'WALLET_SECURITY_ERROR'
                    });
                }
            } else {
                logger.error('Failed to create wallet for user', {
                    userId: user.id,
                    error: walletResult.error,
                });
            }
        }

        // 5. Associar contexto MiniKit se fornecido
        if (miniKitData) {
            addSpanLog(span, 'Associating MiniKit context');
            await authService.associateMiniKitContext(user.id, miniKitData);
        }

        // 6. Registrar login bem-sucedido
        addSpanLog(span, 'Login successful');
        
        logger.info('Google login successful', {
            userId: user.id,
            email: user.email,
            walletAddress,
            sessionId,
            riskScore: loginAnalysis.riskScore,
            riskLevel: loginAnalysis.riskLevel,
            isFlagged: user.isFlagged || false
        });

        finishSpan(span, 'success');

        const response = {
            success: true,
            message: 'Authentication successful',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    picture: user.picture,
                    walletAddress,
                    createdAt: user.createdAt,
                    kycStatus: user.kycStatus,
                    preferences: user.preferences,
                    // Não expor flags de segurança para o frontend
                    // isFlagged: user.isFlagged
                },
                accessToken,
                sessionId,
                correlationId: req.correlationId
            }
        };

        // Adicionar warnings se necessário (sem expor detalhes de segurança)
        if (loginAnalysis.decision === 'REVIEW') {
            response.warnings = ['Account flagged for security review'];
        }

        res.status(200).json(response);

    } catch (error) {
        logger.error('Google login error', {
            error: error.message,
            stack: error.stack,
            ip: req.ip
        });

        finishSpan(span, 'error', error);

        res.status(500).json({
            success: false,
            error: 'Internal server error',
            correlationId: req.correlationId
        });
    }
});

/**
 * POST /api/auth/logout
 * Logout do usuário com logs de segurança
 */
router.post('/logout', requireAuth, async (req, res) => {
    const logger = createLogger(req.correlationId, 'auth-logout');
    const span = createSpan('user_logout', req.span);
    
    try {
        const userId = req.user.id;
        const sessionId = req.tokenPayload.sessionId;

        addSpanTag(span, 'user.id', userId);
        addSpanTag(span, 'session.id', sessionId);

        logger.info('User logout', {
            userId,
            sessionId,
            ip: req.ip
        });

        // Invalidar sessão
        const logoutResult = await authService.logout(sessionId);

        if (!logoutResult.success) {
            finishSpan(span, 'error', new Error(logoutResult.error));
            return res.status(400).json({
                success: false,
                error: logoutResult.error,
            });
        }

        finishSpan(span, 'success');

        res.status(200).json({
            success: true,
            message: 'Logout successful',
        });

    } catch (error) {
        logger.error('Logout error', {
            error: error.message,
            userId: req.user?.id
        });

        finishSpan(span, 'error', error);

        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

/**
 * GET /api/auth/me
 * Obter informações do usuário atual com verificação de segurança
 */
router.get('/me', requireAuth, async (req, res) => {
    const logger = createLogger(req.correlationId, 'auth-me');
    
    try {
        const user = req.user;

        // Se usuário está flagged, registrar acesso
        if (user.isFlagged) {
            logger.info('Flagged user accessed profile', {
                userId: user.id,
                flagReason: user.flagReason,
                ip: req.ip
            });
        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    picture: user.picture,
                    walletAddress: user.walletAddress,
                    createdAt: user.createdAt,
                    kycStatus: user.kycStatus,
                    preferences: user.preferences,
                    // Adicionar flag de review se necessário
                    reviewRequired: user.reviewRequired || false
                }
            }
        });

    } catch (error) {
        logger.error('Get user profile error', {
            error: error.message,
            userId: req.user?.id
        });

        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

/**
 * POST /api/auth/refresh
 * Renovar token de acesso com verificação de segurança
 */
router.post('/refresh', [
    body('refreshToken')
        .isString()
        .isLength({ min: 1 })
        .withMessage('Refresh token is required'),
], handleValidationErrors, async (req, res) => {
    const logger = createLogger(req.correlationId, 'auth-refresh');
    const span = createSpan('token_refresh', req.span);
    
    try {
        const { refreshToken } = req.body;

        addSpanLog(span, 'Refreshing access token');

        const refreshResult = await authService.refreshAccessToken(refreshToken);

        if (!refreshResult.success) {
            finishSpan(span, 'error', new Error(refreshResult.error));
            return res.status(401).json({
                success: false,
                error: refreshResult.error,
            });
        }

        const { user, accessToken, newRefreshToken } = refreshResult;

        // Verificar se usuário foi blacklistado desde o último refresh
        const blacklistCheck = await fraudDetection.getBlacklistService().isBlacklisted(
            'user',
            user.id,
            req.correlationId
        );

        if (blacklistCheck.isBlacklisted && blacklistCheck.severity === 'critical') {
            logger.warn('Blacklisted user attempted token refresh', {
                userId: user.id,
                reason: blacklistCheck.reason
            });

            finishSpan(span, 'blocked', new Error('User blacklisted'));
            
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                code: 'USER_BLACKLISTED'
            });
        }

        addSpanTag(span, 'user.id', user.id);
        finishSpan(span, 'success');

        logger.info('Token refresh successful', {
            userId: user.id,
            ip: req.ip
        });

        res.status(200).json({
            success: true,
            data: {
                accessToken,
                refreshToken: newRefreshToken,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    kycStatus: user.kycStatus,
                }
            }
        });

    } catch (error) {
        logger.error('Token refresh error', {
            error: error.message,
            ip: req.ip
        });

        finishSpan(span, 'error', error);

        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

/**
 * GET /api/auth/sessions
 * Listar sessões ativas do usuário
 */
router.get('/sessions', requireAuth, async (req, res) => {
    const logger = createLogger(req.correlationId, 'auth-sessions');
    
    try {
        const userId = req.user.id;

        const sessionsResult = await authService.getUserSessions(userId);

        if (!sessionsResult.success) {
            return res.status(400).json({
                success: false,
                error: sessionsResult.error,
            });
        }

        // Mascarar informações sensíveis
        const maskedSessions = sessionsResult.sessions.map(session => ({
            id: session.id,
            createdAt: session.createdAt,
            lastAccessAt: session.lastAccessAt,
            userAgent: session.userAgent,
            ipAddress: session.ipAddress ? 
                session.ipAddress.replace(/\.\d+$/, '.***') : // Mascarar último octeto
                'Unknown',
            isCurrent: session.id === req.tokenPayload.sessionId
        }));

        res.status(200).json({
            success: true,
            data: {
                sessions: maskedSessions
            }
        });

    } catch (error) {
        logger.error('Get user sessions error', {
            error: error.message,
            userId: req.user?.id
        });

        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

/**
 * DELETE /api/auth/sessions/:sessionId
 * Revogar sessão específica
 */
router.delete('/sessions/:sessionId', [
    param('sessionId')
        .isString()
        .isLength({ min: 1 })
        .withMessage('Session ID is required'),
], requireAuth, handleValidationErrors, async (req, res) => {
    const logger = createLogger(req.correlationId, 'auth-revoke-session');
    
    try {
        const { sessionId } = req.params;
        const userId = req.user.id;

        logger.info('Revoking user session', {
            userId,
            sessionId,
            revokedBy: req.tokenPayload.sessionId
        });

        const revokeResult = await authService.revokeSession(sessionId, userId);

        if (!revokeResult.success) {
            return res.status(400).json({
                success: false,
                error: revokeResult.error,
            });
        }

        res.status(200).json({
            success: true,
            message: 'Session revoked successfully',
        });

    } catch (error) {
        logger.error('Revoke session error', {
            error: error.message,
            sessionId: req.params.sessionId,
            userId: req.user?.id
        });

        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

module.exports = {
    router,
    requireAuth,
    fraudDetection // Exportar para uso em outros módulos
}; 