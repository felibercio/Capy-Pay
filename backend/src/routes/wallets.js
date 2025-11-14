const express = require('express');
const { body, validationResult } = require('express-validator');
const SupabaseService = require('../services/SupabaseService');
const AuthService = require('../services/AuthService');
const logger = require('../utils/logger');

const router = express.Router();
const supabase = new SupabaseService();
const authService = new AuthService();

// Validação básica
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

// Middleware opcional de auth: se houver Bearer, valida e popula req.user
// Middleware obrigatório de auth: exige Bearer e popula req.user
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization token required' });
    }
    const token = authHeader.substring(7);
    const verification = await authService.verifyAccessToken(token);
    if (!verification.valid) {
      return res.status(401).json({ success: false, error: verification.error });
    }
    req.user = verification.user;
    req.tokenPayload = verification.payload;
    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

/**
 * POST /api/wallets/connect
 * Registra conexão de carteira não-custodial no Supabase
 */
router.post('/connect', requireAuth, [
  body('walletAddress')
    .isString()
    .isLength({ min: 42, max: 42 })
    .withMessage('walletAddress must be a valid 42-char hex address'),
  body('walletType')
    .isString()
    .isIn(['metamask', 'walletconnect', 'coinbase'])
    .withMessage('walletType must be metamask, walletconnect, or coinbase'),
], handleValidationErrors, async (req, res) => {
  try {
    const { walletAddress, walletType } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User authentication required' });
    }

    // Supabase configurado?
    if (!supabase.url || !supabase.serviceKey) {
      logger.warn('Supabase not configured; skipping DB insert', {
        walletAddress,
        walletType,
        userId,
      });
      return res.status(503).json({
        success: false,
        error: 'Supabase is not configured in this environment',
      });
    }

    logger.info('Registering wallet connection', {
      walletAddress,
      walletType,
      userId,
      ip: req.ip,
    });

    const record = await supabase.insertWalletConnection({
      wallet_address: walletAddress,
      wallet_type: walletType,
      user_id: userId,
    });

    return res.status(201).json({
      success: true,
      message: 'Wallet connection registered',
      data: record,
    });
  } catch (error) {
    logger.error('Error registering wallet connection', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;