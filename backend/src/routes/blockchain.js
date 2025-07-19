const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const BlockchainMonitorService = require('../services/BlockchainMonitorService');
const SwapService = require('../services/SwapService');
const logger = require('../utils/logger');

const router = express.Router();
const blockchainMonitor = new BlockchainMonitorService();
const swapService = new SwapService();

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
 * GET /api/blockchain/status
 * Verifica status dos serviços blockchain
 */
router.get('/status', async (req, res) => {
  try {
    const [monitorStatus, swapStatus] = await Promise.all([
      blockchainMonitor.getServiceStatus(),
      swapService.getServiceStatus(),
    ]);

    res.json({
      success: true,
      data: {
        monitor: monitorStatus,
        swap: swapStatus,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting blockchain status', {
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
 * POST /api/blockchain/monitor/start
 * Inicia monitoramento de depósitos
 */
router.post('/monitor/start', async (req, res) => {
  try {
    logger.info('Starting blockchain monitoring via API');

    await blockchainMonitor.startMonitoring();

    res.json({
      success: true,
      message: 'Blockchain monitoring started successfully',
    });
  } catch (error) {
    logger.error('Error starting monitoring via API', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/blockchain/monitor/stop
 * Para monitoramento de depósitos
 */
router.post('/monitor/stop', async (req, res) => {
  try {
    logger.info('Stopping blockchain monitoring via API');

    await blockchainMonitor.stopMonitoring();

    res.json({
      success: true,
      message: 'Blockchain monitoring stopped successfully',
    });
  } catch (error) {
    logger.error('Error stopping monitoring via API', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/blockchain/balances
 * Obtém saldos de todos os tokens
 */
router.get('/balances', [
  query('address')
    .optional()
    .isEthereumAddress()
    .withMessage('Invalid Ethereum address'),
], handleValidationErrors, async (req, res) => {
  try {
    const { address } = req.query;

    logger.info('Getting token balances', { address });

    const balances = await blockchainMonitor.getAllBalances(address);

    res.json({
      success: true,
      data: {
        balances,
        address: address || process.env.BASE_WALLET_ADDRESS,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error getting balances', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/blockchain/balance/:token
 * Obtém saldo de um token específico
 */
router.get('/balance/:token', [
  param('token')
    .isIn(['USDC', 'BRZ', 'EURC'])
    .withMessage('Token must be USDC, BRZ, or EURC'),
  query('address')
    .optional()
    .isEthereumAddress()
    .withMessage('Invalid Ethereum address'),
], handleValidationErrors, async (req, res) => {
  try {
    const { token } = req.params;
    const { address } = req.query;

    logger.info('Getting token balance', { token, address });

    const balance = await blockchainMonitor.getTokenBalance(token, address);

    res.json({
      success: true,
      data: balance,
    });
  } catch (error) {
    logger.error('Error getting token balance', {
      error: error.message,
      token: req.params.token,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/blockchain/deposits
 * Lista histórico de depósitos
 */
router.get('/deposits', [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
], handleValidationErrors, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    logger.info('Getting deposit history', { limit });

    const deposits = blockchainMonitor.getDepositHistory(limit);

    res.json({
      success: true,
      data: {
        deposits,
        count: deposits.length,
        limit,
      },
    });
  } catch (error) {
    logger.error('Error getting deposit history', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/blockchain/swap/quote
 * Obtém cotação para swap
 */
router.post('/swap/quote', [
  body('fromToken')
    .isIn(['USDC', 'BRZ', 'EURC'])
    .withMessage('From token must be USDC, BRZ, or EURC'),
  body('toToken')
    .isIn(['USDC', 'BRZ', 'EURC'])
    .withMessage('To token must be USDC, BRZ, or EURC'),
  body('amount')
    .isFloat({ min: 0.0001 })
    .withMessage('Amount must be a positive number'),
], handleValidationErrors, async (req, res) => {
  try {
    const { fromToken, toToken, amount } = req.body;

    if (fromToken === toToken) {
      return res.status(400).json({
        success: false,
        error: 'From and to tokens cannot be the same',
      });
    }

    logger.info('Getting swap quote', {
      fromToken,
      toToken,
      amount,
      ip: req.ip,
    });

    const quote = await swapService.getBestRoute(fromToken, toToken, amount);

    res.json({
      success: true,
      data: quote,
    });
  } catch (error) {
    logger.error('Error getting swap quote', {
      error: error.message,
      fromToken: req.body.fromToken,
      toToken: req.body.toToken,
      amount: req.body.amount,
    });

    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/blockchain/swap/execute
 * Executa swap entre tokens
 */
router.post('/swap/execute', [
  body('fromToken')
    .isIn(['USDC', 'BRZ', 'EURC'])
    .withMessage('From token must be USDC, BRZ, or EURC'),
  body('toToken')
    .isIn(['USDC', 'BRZ', 'EURC'])
    .withMessage('To token must be USDC, BRZ, or EURC'),
  body('amount')
    .isFloat({ min: 0.0001 })
    .withMessage('Amount must be a positive number'),
  body('privateKey')
    .isLength({ min: 64, max: 66 })
    .withMessage('Invalid private key format'),
  body('maxPriceImpact')
    .optional()
    .isFloat({ min: 0, max: 50 })
    .withMessage('Max price impact must be between 0 and 50'),
], handleValidationErrors, async (req, res) => {
  try {
    const { fromToken, toToken, amount, privateKey, maxPriceImpact = 5 } = req.body;

    if (fromToken === toToken) {
      return res.status(400).json({
        success: false,
        error: 'From and to tokens cannot be the same',
      });
    }

    logger.info('Executing swap', {
      fromToken,
      toToken,
      amount,
      maxPriceImpact,
      ip: req.ip,
    });

    // Verificar viabilidade do swap
    const viabilityCheck = await swapService.isSwapViable(
      fromToken,
      toToken,
      amount,
      maxPriceImpact
    );

    if (!viabilityCheck.isViable) {
      return res.status(400).json({
        success: false,
        error: `Swap not viable. Price impact: ${viabilityCheck.priceImpact}%, max allowed: ${maxPriceImpact}%`,
        data: viabilityCheck,
      });
    }

    // Executar swap
    const result = await swapService.executeSwap(
      fromToken,
      toToken,
      amount,
      privateKey,
      {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
      }
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Swap executed successfully',
        data: {
          txHash: result.txHash,
          fromAmount: result.fromAmount,
          toAmount: result.toAmount,
          gasUsed: result.gasUsed,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error('Error executing swap', {
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
 * POST /api/blockchain/swap/price-impact
 * Calcula impacto de preço para swap
 */
router.post('/swap/price-impact', [
  body('fromToken')
    .isIn(['USDC', 'BRZ', 'EURC'])
    .withMessage('From token must be USDC, BRZ, or EURC'),
  body('toToken')
    .isIn(['USDC', 'BRZ', 'EURC'])
    .withMessage('To token must be USDC, BRZ, or EURC'),
  body('amount')
    .isFloat({ min: 0.0001 })
    .withMessage('Amount must be a positive number'),
], handleValidationErrors, async (req, res) => {
  try {
    const { fromToken, toToken, amount } = req.body;

    if (fromToken === toToken) {
      return res.status(400).json({
        success: false,
        error: 'From and to tokens cannot be the same',
      });
    }

    logger.info('Calculating price impact', {
      fromToken,
      toToken,
      amount,
    });

    const priceImpact = await swapService.calculatePriceImpact(
      fromToken,
      toToken,
      amount
    );

    res.json({
      success: true,
      data: priceImpact,
    });
  } catch (error) {
    logger.error('Error calculating price impact', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/blockchain/swaps
 * Lista histórico de swaps
 */
router.get('/swaps', [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
], handleValidationErrors, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    logger.info('Getting swap history', { limit });

    const swaps = swapService.getSwapHistory(limit);

    res.json({
      success: true,
      data: {
        swaps,
        count: swaps.length,
        limit,
      },
    });
  } catch (error) {
    logger.error('Error getting swap history', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router; 