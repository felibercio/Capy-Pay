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
const logger = require('../utils/logger');

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
 * Middleware para validar token JWT
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required',
      });
    }

    const token = authHeader.substring(7);
    const verification = await authService.verifyAccessToken(token);

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        error: verification.error,
      });
    }

    req.user = verification.user;
    req.tokenPayload = verification.payload;
    next();
  } catch (error) {
    logger.error('Auth middleware error', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * POST /api/auth/google-login
 * Autenticação via Google OAuth
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
  try {
    const { googleToken, miniKitData } = req.body;
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip;

    logger.info('Google login attempt', {
      ip: ipAddress,
      userAgent,
      hasMiniKitData: !!miniKitData,
    });

    // 1. Autenticar com Google
    const authResult = await authService.authenticateWithGoogle(googleToken);

    if (!authResult.success) {
      return res.status(400).json({
        success: false,
        error: authResult.error,
      });
    }

    const { user, accessToken, sessionId } = authResult;

    // 2. Criar carteira custodial se não existir
    let walletAddress = user.walletAddress;
    if (!walletAddress) {
      logger.info('Creating custodial wallet for new user', {
        userId: user.id,
      });

      const walletResult = await walletService.createWalletForUser(user.id, { authToken: accessToken, provider: 'google' });
      if (walletResult.success) {
        walletAddress = walletResult.wallet.address;
        user.walletAddress = walletAddress;
      } else {
        logger.error('Failed to create wallet for user', {
          userId: user.id,
          error: walletResult.error,
        });
      }
    }

    // 3. Associar contexto MiniKit se fornecido
    if (miniKitData) {
      await authService.associateMiniKitContext(user.id, miniKitData);
    }

    // 4. Atualizar sessão com informações de contexto
    // TODO: Implementar atualização de sessão com IP e User-Agent

    logger.info('Google login successful', {
      userId: user.id,
      email: user.email,
      walletAddress,
      sessionId,
    });

    // Persistir perfil com providers='google' via RLS quando possível
    try {
      await authService.supabaseService.upsertUserProfileWithUserToken({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        googleId: user.googleId || user.id,
        walletAddress: walletAddress || user.walletAddress || null,
        providers: 'google',
        createdAt: user.createdAt,
      }, accessToken);
    } catch (e) {
      logger.warn('Profile upsert via RLS failed; attempting admin fallback', { error: e.message });
      try {
        await authService.supabaseService.upsertUserProfile({
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          googleId: user.googleId || user.id,
          walletAddress: walletAddress || user.walletAddress || null,
          providers: 'google',
          createdAt: user.createdAt,
        });
      } catch (adminErr) {
        logger.warn('Admin profile upsert also failed', { error: adminErr.message });
      }
    }

    res.status(200).json({
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
        },
        accessToken,
        sessionId,
        expiresAt: authResult.expiresAt,
      },
    });

  } catch (error) {
    logger.error('Google login error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/auth/email-login/complete
 * Finaliza login de email/senha (feito no frontend via Supabase) garantindo criação de carteira
 */
router.post('/email-login/complete', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    logger.info('Email login completion request', { userId });

    // Criar carteira custodial se não existir
    let walletAddress = req.user.walletAddress || null;
    if (!walletAddress) {
      logger.info('Creating custodial wallet for email user', { userId });
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
      const walletResult = await walletService.createWalletForUser(userId, { authToken: token, provider: 'email' });
      if (!walletResult.success) {
        return res.status(500).json({ success: false, error: walletResult.error || 'Failed to create wallet' });
      }
      walletAddress = walletResult.wallet.address;

      // Telemetria: carteira criada via fluxo email-login
      try {
        observability.recordWalletCreated('email', 'base', userId, walletAddress);
      } catch (e) {}
    }

    // Upsert de perfil com providers = 'email' e wallet atualizada
    try {
      await authService.supabaseService.upsertUserProfileWithUserToken({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture,
        googleId: null,
        walletAddress: walletAddress,
        providers: 'email',
        createdAt: req.user.createdAt,
      }, token);
    } catch (upErr) {
      logger.warn('Falha ao atualizar perfil do usuário com providers=email (RLS)', {
        userId,
        error: upErr.message,
      });
      // Admin fallback
      try {
        await authService.supabaseService.upsertUserProfile({
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          picture: req.user.picture,
          googleId: null,
          walletAddress: walletAddress,
          providers: 'email',
          createdAt: req.user.createdAt,
        });
      } catch (adminErr) {
        logger.warn('Fallback admin upsert falhou', { error: adminErr.message });
      }
    }

    // Perfil consolidado
    const balanceResult = await walletService.getWalletBalance(userId);

    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          picture: req.user.picture,
          walletAddress,
          createdAt: req.user.createdAt,
        },
        wallet: balanceResult.success ? {
          address: walletAddress,
          balances: balanceResult.balances,
        } : {
          address: walletAddress,
          balances: null,
        },
      },
    });
  } catch (error) {
    logger.error('Email login completion error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/minikit-associate
 * Associa contexto MiniKit/Farcaster ao usuário autenticado
 */
router.post('/minikit-associate', requireAuth, [
  body('worldId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('World ID is required'),
  body('appId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('App ID is required'),
  body('verified')
    .isBoolean()
    .withMessage('Verified status must be boolean'),
  body('farcaster')
    .optional()
    .isObject()
    .withMessage('Farcaster data must be an object'),
], handleValidationErrors, async (req, res) => {
  try {
    const { worldId, appId, verified, farcaster } = req.body;
    const userId = req.user.id;

    logger.info('Associating MiniKit context', {
      userId,
      worldId,
      appId,
      verified,
    });

    const result = await authService.associateMiniKitContext(userId, {
      worldId,
      appId,
      verified,
      farcaster,
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'MiniKit context associated successfully',
        data: {
          user: result.user,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }

  } catch (error) {
    logger.error('MiniKit association error', {
      error: error.message,
      userId: req.user.id,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/auth/profile
 * Obtém perfil do usuário autenticado
 */
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obter dados atualizados do usuário
    // TODO: Buscar dados frescos do banco
    const user = req.user;

    // Obter saldo da carteira
    const balanceResult = await walletService.getWalletBalance(userId);

    res.json({
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
          miniKit: user.miniKit,
          farcaster: user.farcaster,
        },
        wallet: balanceResult.success ? {
          address: balanceResult.address,
          balances: balanceResult.balances,
        } : null,
      },
    });

  } catch (error) {
    logger.error('Profile fetch error', {
      error: error.message,
      userId: req.user.id,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * PUT /api/auth/profile
 * Atualiza perfil do usuário
 */
router.put('/profile', requireAuth, [
  body('name')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object'),
  body('preferences.notifications')
    .optional()
    .isBoolean()
    .withMessage('Notifications preference must be boolean'),
  body('preferences.language')
    .optional()
    .isIn(['pt-BR', 'en-US', 'es-ES'])
    .withMessage('Language must be pt-BR, en-US, or es-ES'),
  body('preferences.currency')
    .optional()
    .isIn(['BRL', 'USD', 'EUR'])
    .withMessage('Currency must be BRL, USD, or EUR'),
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    logger.info('Updating user profile', {
      userId,
      updates,
    });

    // TODO: Implementar atualização real do perfil
    // const updatedUser = await authService.updateUserProfile(userId, updates);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          ...req.user,
          ...updates,
          updatedAt: new Date(),
        },
      },
    });

  } catch (error) {
    logger.error('Profile update error', {
      error: error.message,
      userId: req.user.id,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/auth/logout
 * Encerra sessão do usuário
 */
router.post('/logout', requireAuth, [
  body('sessionId')
    .optional()
    .isString()
    .withMessage('Session ID must be a string'),
], handleValidationErrors, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    logger.info('User logout', {
      userId,
      sessionId,
    });

    // Encerrar sessão específica ou todas as sessões do usuário
    const logoutResult = await authService.logout(sessionId);

    if (logoutResult.success) {
      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: logoutResult.error,
      });
    }

  } catch (error) {
    logger.error('Logout error', {
      error: error.message,
      userId: req.user.id,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/auth/wallet/address
 * Obtém endereço da carteira custodial
 */
router.get('/wallet/address', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const walletAddress = await walletService.getWalletAddress(userId);

    if (!walletAddress) {
      // Auto-provisionar carteira no primeiro acesso
      const provider = req.user?.providers || (req.user?.googleId ? 'google' : 'email');
      const createResult = await walletService.createWalletForUser(userId, { authToken: token, provider });
      if (!createResult.success) {
        return res.status(400).json({
          success: false,
          error: createResult.error || 'Failed to create wallet',
        });
      }
      const createdAddress = createResult.wallet.address;

      // Telemetria: carteira criada
      try {
        observability.recordWalletCreated(provider, 'base', req.user.id, createdAddress);
        const log = createLogger(req.correlationId, 'wallet');
        log.info('Custodial wallet auto-provisioned', {
          userId: req.user.id,
          provider,
          network: 'base',
          address: createdAddress,
        });
      } catch (teleErr) {
        logger.warn('Wallet creation telemetry failed', { error: teleErr.message });
      }
      return res.json({
        success: true,
        data: {
          address: createdAddress,
          network: 'base',
          created: true,
        },
      });
    }

    res.json({
      success: true,
      data: {
        address: walletAddress,
        network: 'base',
        created: false,
      },
    });

  } catch (error) {
    logger.error('Wallet address fetch error', {
      error: error.message,
      userId: req.user.id,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/auth/wallet/balance
 * Obtém saldo da carteira custodial
 */
router.get('/wallet/balance', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const balanceResult = await walletService.getWalletBalance(userId);

    if (balanceResult.success) {
      res.json({
        success: true,
        data: balanceResult,
      });
    } else {
      res.status(400).json({
        success: false,
        error: balanceResult.error,
      });
    }

  } catch (error) {
    logger.error('Wallet balance fetch error', {
      error: error.message,
      userId: req.user.id,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/auth/wallet/sign-transaction
 * Assina transação usando carteira custodial
 */
router.post('/wallet/sign-transaction', requireAuth, [
  body('to')
    .isEthereumAddress()
    .withMessage('Invalid destination address'),
  body('value')
    .optional()
    .isString()
    .withMessage('Value must be a string'),
  body('data')
    .optional()
    .isString()
    .withMessage('Data must be a string'),
  body('gasLimit')
    .optional()
    .isString()
    .withMessage('Gas limit must be a string'),
  body('gasPrice')
    .optional()
    .isString()
    .withMessage('Gas price must be a string'),
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user.id;
    const transaction = req.body;

    logger.info('Signing transaction for user', {
      userId,
      to: transaction.to,
      value: transaction.value,
    });

    const signResult = await walletService.signTransaction(userId, transaction);

    if (signResult.success) {
      res.json({
        success: true,
        message: 'Transaction signed successfully',
        data: {
          signedTransaction: signResult.signedTransaction,
          transactionHash: signResult.transactionHash,
          gasEstimate: signResult.gasEstimate,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: signResult.error,
      });
    }

  } catch (error) {
    logger.error('Transaction signing error', {
      error: error.message,
      userId: req.user.id,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/auth/sessions
 * Lista sessões ativas do usuário
 */
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // TODO: Implementar listagem real de sessões
    const sessions = []; // Placeholder

    res.json({
      success: true,
      data: {
        sessions,
        count: sessions.length,
      },
    });

  } catch (error) {
    logger.error('Sessions fetch error', {
      error: error.message,
      userId: req.user.id,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/auth/stats
 * Estatísticas de autenticação (admin)
 */
router.get('/stats', async (req, res) => {
  try {
    // TODO: Implementar middleware de admin

    const authStats = authService.getAuthStats();
    const walletStats = walletService.getWalletStats();

    res.json({
      success: true,
      data: {
        auth: authStats,
        wallets: walletStats,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('Stats fetch error', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});
/**
 * POST /api/auth/telemetry/event
 * Registra eventos de telemetria (primeiro acesso, etc.)
 */
router.post('/telemetry/event', requireAuth, [
  body('eventType')
    .isIn(['dashboard_first_access'])
    .withMessage('Invalid event type'),
  body('source')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Source must be a short string')
], handleValidationErrors, async (req, res) => {
  try {
    const { eventType, source } = req.body;
    const provider = req.user?.providers || (req.user?.googleId ? 'google' : 'email');
    const userId = req.user?.id;

    const log = createLogger(req.correlationId, 'telemetry');
    if (eventType === 'dashboard_first_access') {
      try {
        observability.recordFirstAccess(source || 'dashboard', provider, userId);
      } catch (e) {}
      log.info('First dashboard access telemetry', { userId, provider, source: source || 'dashboard' });
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error('Telemetry event error', { error: error.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;