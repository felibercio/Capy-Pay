const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', (req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    services: {
      starkbank: 'operational', // TODO: Verificar conexão real
      database: 'not_configured', // TODO: Verificar conexão quando implementado
      redis: 'not_configured', // TODO: Verificar conexão quando implementado
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
    },
  };

  logger.info('Health check requested', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.json(healthData);
});

/**
 * GET /health/detailed
 * Detailed health check with service status
 */
router.get('/detailed', async (req, res) => {
  try {
    const healthData = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        starkbank: await checkStarkBankHealth(),
        database: 'not_configured',
        redis: 'not_configured',
        webhook: 'configured',
      },
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version,
      },
      configuration: {
        port: process.env.PORT || 3001,
        logLevel: process.env.LOG_LEVEL || 'info',
        starkbankEnvironment: process.env.STARKBANK_ENVIRONMENT || 'sandbox',
      },
    };

    res.json(healthData);
  } catch (error) {
    logger.error('Error in detailed health check', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * Verifica saúde do StarkBank
 */
async function checkStarkBankHealth() {
  try {
    // TODO: Implementar verificação real da conexão StarkBank
    // Por exemplo, fazer uma chamada simples à API
    
    if (process.env.STARKBANK_PROJECT_ID && process.env.STARKBANK_PRIVATE_KEY_PATH) {
      return 'configured';
    } else {
      return 'not_configured';
    }
  } catch (error) {
    logger.error('StarkBank health check failed', { error: error.message });
    return 'error';
  }
}

module.exports = router; 