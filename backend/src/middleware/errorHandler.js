const logger = require('../utils/logger');

/**
 * Middleware para tratar erros não encontrados (404)
 */
const notFoundHandler = (req, res, next) => {
  logger.warn('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.path}`,
  });
};

/**
 * Middleware global de tratamento de erros
 */
const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    ip: req.ip,
    body: req.body,
  });

  // Erro de validação do express-validator
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON payload',
    });
  }

  // Erro de payload muito grande
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Payload too large',
    });
  }

  // Erro de timeout
  if (err.code === 'ETIMEDOUT') {
    return res.status(408).json({
      success: false,
      error: 'Request timeout',
    });
  }

  // Erro de StarkBank
  if (err.name === 'StarkBankError') {
    return res.status(400).json({
      success: false,
      error: 'Payment service error',
      message: err.message,
    });
  }

  // Erro padrão
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
}; 