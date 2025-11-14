const express = require('express');
const { body, validationResult } = require('express-validator');
const SupabaseService = require('../services/SupabaseService');
const AuthService = require('../services/AuthService');
const logger = require('../utils/logger');

const router = express.Router();
const supa = new SupabaseService();
const authService = new AuthService();

// Middleware para validar erros
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
 * Middleware para autenticação via JWT
 * Usa AuthService.verifyAccessToken para obter req.user.id
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
    logger.error('Deposits auth middleware error', { error: error.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

/**
 * GET /api/deposits
 * Lista depósitos do usuário
 */
router.get('/', [
  body('userId')
    .optional()
    .isString()
    .isLength({ min: 1 })
    .withMessage('User ID must be a valid string'),
], handleValidationErrors, async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Verificar Supabase configurado
    if (!supa.url || !supa.serviceKey) {
      return res.status(503).json({
        success: false,
        error: 'Supabase is not configured in this environment',
      });
    }

    logger.info('User deposits request', {
      userId,
      ip: req.ip,
    });

    const deposits = await supa.listDepositsByUser(userId);

    res.json({
      success: true,
      data: {
        deposits,
        count: deposits.length,
      },
    });
  } catch (error) {
    logger.error('Error in user deposits endpoint', {
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
 * GET /api/deposits/me
 * Lista depósitos do usuário autenticado (via JWT)
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
      });
    }

    if (!supa.url || !supa.serviceKey) {
      return res.status(503).json({
        success: false,
        error: 'Supabase is not configured in this environment',
      });
    }

    logger.info('Authenticated user deposits request', {
      userId,
      ip: req.ip,
    });

    const deposits = await supa.listDepositsByUser(userId);

    res.json({
      success: true,
      data: {
        deposits,
        count: deposits.length,
      },
    });
  } catch (error) {
    logger.error('Error in authenticated user deposits endpoint', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

module.exports = router;