const express = require('express');
const { body, param, validationResult } = require('express-validator');
const StarkBankService = require('../services/StarkBankService');
const logger = require('../utils/logger');

const router = express.Router();
const starkBankService = new StarkBankService();

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
 * POST /api/payments/pix/generate
 * Gera um QR Code PIX para depósito
 */
router.post('/pix/generate', [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number')
    .toFloat(),
  body('description')
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('Description must be between 1 and 200 characters'),
  body('userId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('User ID is required'),
], handleValidationErrors, async (req, res) => {
  try {
    const { amount, description, userId } = req.body;
    
    // Converter para centavos
    const amountInCents = Math.round(amount * 100);

    logger.info('PIX generation request', {
      userId,
      amount: amountInCents,
      description,
      ip: req.ip,
    });

    const result = await starkBankService.generatePixQrCode(
      amountInCents,
      description,
      userId
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'PIX QR Code generated successfully',
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error('Error in PIX generation endpoint', {
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
 * POST /api/payments/bill/pay
 * Processa pagamento de boleto
 */
router.post('/bill/pay', [
  body('barcode')
    .isString()
    .matches(/^[0-9]{47,48}$/)
    .withMessage('Invalid barcode format'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number')
    .toFloat(),
  body('userId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('User ID is required'),
], handleValidationErrors, async (req, res) => {
  try {
    const { barcode, amount, userId } = req.body;
    
    // Converter para centavos
    const amountInCents = Math.round(amount * 100);

    logger.info('Bill payment request', {
      userId,
      amount: amountInCents,
      barcode: barcode.substring(0, 10) + '...', // Log apenas parte do código
      ip: req.ip,
    });

    const result = await starkBankService.payBill(
      barcode,
      amountInCents,
      userId
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Bill payment processed successfully',
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error('Error in bill payment endpoint', {
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
 * GET /api/payments/transaction/:id
 * Obtém detalhes de uma transação
 */
router.get('/transaction/:id', [
  param('id')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Transaction ID is required'),
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Transaction lookup request', {
      transactionId: id,
      ip: req.ip,
    });

    const transaction = starkBankService.getTransaction(id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    logger.error('Error in transaction lookup endpoint', {
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
 * GET /api/payments/transactions
 * Lista transações do usuário
 */
router.get('/transactions', [
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

    logger.info('User transactions request', {
      userId,
      ip: req.ip,
    });

    const transactions = starkBankService.getUserTransactions(userId);

    res.json({
      success: true,
      data: {
        transactions,
        count: transactions.length,
      },
    });
  } catch (error) {
    logger.error('Error in user transactions endpoint', {
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
 * GET /api/payments/status
 * Verifica status do serviço de pagamentos
 */
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        service: 'payments',
        status: 'operational',
        timestamp: new Date().toISOString(),
        features: {
          pixGeneration: true,
          billPayment: true,
          transactionLookup: true,
        },
      },
    });
  } catch (error) {
    logger.error('Error in payments status endpoint', {
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