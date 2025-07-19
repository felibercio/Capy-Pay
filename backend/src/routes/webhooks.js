const express = require('express');
const crypto = require('crypto');
const StarkBankService = require('../services/StarkBankService');
const logger = require('../utils/logger');

const router = express.Router();
const starkBankService = new StarkBankService();

/**
 * Middleware para validar assinatura do webhook
 */
const validateWebhookSignature = (req, res, next) => {
  try {
    const signature = req.headers['digital-signature'];
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      logger.warn('Webhook signature validation failed - missing signature or secret');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - Invalid signature',
      });
    }

    // Verificar assinatura (implementação simplificada)
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('Webhook signature validation failed - signature mismatch', {
        received: signature,
        expected: expectedSignature,
      });
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - Invalid signature',
      });
    }

    next();
  } catch (error) {
    logger.error('Error validating webhook signature', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * POST /api/starkbank/webhook
 * Endpoint para receber webhooks do StarkBank
 */
router.post('/webhook', validateWebhookSignature, async (req, res) => {
  try {
    const eventData = req.body;

    logger.info('Webhook event received', {
      subscription: eventData.subscription,
      eventId: eventData.id,
      created: eventData.created,
    });

    // Processar evento
    const result = await starkBankService.handleWebhookEvent(eventData);

    if (result.success) {
      logger.info('Webhook event processed successfully', {
        eventId: eventData.id,
        subscription: eventData.subscription,
      });

      // StarkBank espera status 200 para confirmar recebimento
      res.status(200).json({
        success: true,
        message: 'Event processed successfully',
      });
    } else {
      logger.error('Failed to process webhook event', {
        eventId: eventData.id,
        error: result.error,
      });

      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error('Error processing webhook', {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/starkbank/webhook/setup
 * Configura webhook no StarkBank (endpoint administrativo)
 */
router.post('/webhook/setup', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Webhook URL is required',
      });
    }

    logger.info('Setting up webhook', { url });

    const result = await starkBankService.setupWebhook(url);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Webhook configured successfully',
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error('Error setting up webhook', {
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
 * GET /api/starkbank/webhook/test
 * Endpoint de teste para webhook
 */
router.get('/webhook/test', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is operational',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

module.exports = router; 