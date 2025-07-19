const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Middleware para validar API Key
 */
const validateApiKey = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const expectedApiKey = process.env.API_KEY;

    // Em desenvolvimento, permitir sem API key
    if (process.env.NODE_ENV === 'development' && !expectedApiKey) {
      logger.warn('API Key validation skipped in development mode');
      return next();
    }

    if (!apiKey) {
      logger.warn('API Key missing in request', {
        ip: req.ip,
        path: req.path,
      });

      return res.status(401).json({
        success: false,
        error: 'API Key required',
      });
    }

    if (apiKey !== expectedApiKey) {
      logger.warn('Invalid API Key provided', {
        ip: req.ip,
        path: req.path,
        providedKey: apiKey.substring(0, 8) + '...',
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid API Key',
      });
    }

    next();
  } catch (error) {
    logger.error('Error validating API Key', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * Middleware para validar JWT token
 */
const validateJWT = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'JWT token required',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid JWT token',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'JWT token expired',
      });
    }

    logger.error('Error validating JWT', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * Gera JWT token
 */
const generateJWT = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });
};

module.exports = {
  validateApiKey,
  validateJWT,
  generateJWT,
}; 