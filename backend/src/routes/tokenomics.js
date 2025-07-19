const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const TokenomicsService = require('../services/TokenomicsService');
const logger = require('../utils/logger');

const router = express.Router();
const tokenomicsService = new TokenomicsService();

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
 * Middleware para extrair userId do token JWT
 */
const extractUserId = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: 'User authentication required',
    });
  }
  req.userId = req.user.id;
  next();
};

/**
 * GET /api/tokenomics/dashboard
 * Dashboard completo de tokenomics do usuário
 */
router.get('/dashboard', extractUserId, async (req, res) => {
  try {
    const userId = req.userId;

    logger.info('Tokenomics dashboard request', { userId });

    const dashboard = await tokenomicsService.getUserTokenomicsDashboard(userId);

    if (dashboard.success) {
      res.status(200).json({
        success: true,
        data: dashboard.dashboard,
      });
    } else {
      res.status(400).json({
        success: false,
        error: dashboard.error,
      });
    }

  } catch (error) {
    logger.error('Tokenomics dashboard request failed', {
      error: error.message,
      userId: req.userId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/tokenomics/rewards/profile
 * Perfil detalhado de recompensas
 */
router.get('/rewards/profile', extractUserId, async (req, res) => {
  try {
    const userId = req.userId;

    const profile = await tokenomicsService.rewardsService.getUserRewardsProfile(userId);

    if (profile.success) {
      res.status(200).json({
        success: true,
        data: profile.profile,
      });
    } else {
      res.status(400).json({
        success: false,
        error: profile.error,
      });
    }

  } catch (error) {
    logger.error('Rewards profile request failed', {
      error: error.message,
      userId: req.userId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/tokenomics/rewards/convert
 * Converte Capy Points em Capy Coins
 */
router.post('/rewards/convert', extractUserId, [
  body('pointsToConvert')
    .isInt({ min: 100 })
    .withMessage('Minimum 100 points required for conversion'),
], handleValidationErrors, async (req, res) => {
  try {
    const { pointsToConvert } = req.body;
    const userId = req.userId;

    logger.info('Points to coins conversion request', {
      userId,
      pointsToConvert,
    });

    const result = await tokenomicsService.rewardsService.convertPointsToCoins(
      userId, 
      pointsToConvert
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Points converted to coins successfully',
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }

  } catch (error) {
    logger.error('Points conversion failed', {
      error: error.message,
      userId: req.userId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/tokenomics/referral
 * Processa referral de usuário
 */
router.post('/referral', extractUserId, [
  body('referredUserId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Referred user ID is required'),
], handleValidationErrors, async (req, res) => {
  try {
    const { referredUserId } = req.body;
    const referrerId = req.userId;

    if (referrerId === referredUserId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot refer yourself',
      });
    }

    logger.info('Referral processing request', {
      referrerId,
      referredUserId,
    });

    const result = await tokenomicsService.rewardsService.processReferral(
      referrerId,
      referredUserId
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Referral processed successfully',
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }

  } catch (error) {
    logger.error('Referral processing failed', {
      error: error.message,
      referrerId: req.userId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/tokenomics/brcapy/value
 * Valor atual da BRcapy
 */
router.get('/brcapy/value', async (req, res) => {
  try {
    const valueData = await tokenomicsService.brcapyService.getBRcapyValue();

    if (valueData.success) {
      res.status(200).json({
        success: true,
        data: valueData.data,
      });
    } else {
      res.status(400).json({
        success: false,
        error: valueData.error,
      });
    }

  } catch (error) {
    logger.error('BRcapy value request failed', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/tokenomics/brcapy/position
 * Posição do usuário em BRcapy
 */
router.get('/brcapy/position', extractUserId, async (req, res) => {
  try {
    const userId = req.userId;

    const position = await tokenomicsService.brcapyService.getUserPosition(userId);

    if (position.success) {
      res.status(200).json({
        success: true,
        data: position.position,
      });
    } else {
      res.status(400).json({
        success: false,
        error: position.error,
      });
    }

  } catch (error) {
    logger.error('BRcapy position request failed', {
      error: error.message,
      userId: req.userId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/tokenomics/brcapy/mint
 * Mint BRcapy tokens
 */
router.post('/brcapy/mint', extractUserId, [
  body('brlAmount')
    .isFloat({ min: 10 })
    .withMessage('Minimum investment is 10 BRL'),
], handleValidationErrors, async (req, res) => {
  try {
    const { brlAmount } = req.body;
    const userId = req.userId;

    logger.info('BRcapy mint request', {
      userId,
      brlAmount,
    });

    const result = await tokenomicsService.brcapyService.mintBRcapy(userId, brlAmount);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'BRcapy minted successfully',
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }

  } catch (error) {
    logger.error('BRcapy mint failed', {
      error: error.message,
      userId: req.userId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/tokenomics/brcapy/burn
 * Burn BRcapy tokens
 */
router.post('/brcapy/burn', extractUserId, [
  body('brcapyAmount')
    .isFloat({ min: 1 })
    .withMessage('Minimum burn amount is 1 BRcapy'),
], handleValidationErrors, async (req, res) => {
  try {
    const { brcapyAmount } = req.body;
    const userId = req.userId;

    logger.info('BRcapy burn request', {
      userId,
      brcapyAmount,
    });

    const result = await tokenomicsService.brcapyService.burnBRcapy(userId, brcapyAmount);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'BRcapy burned successfully',
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }

  } catch (error) {
    logger.error('BRcapy burn failed', {
      error: error.message,
      userId: req.userId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/tokenomics/liquidity/rates
 * Melhores taxas de swap com incentivos
 */
router.get('/liquidity/rates', extractUserId, [
  query('fromToken')
    .isIn(['USDC', 'BRZ', 'EURC'])
    .withMessage('Invalid source token'),
  query('toToken')
    .isIn(['USDC', 'BRZ', 'EURC'])
    .withMessage('Invalid destination token'),
  query('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0.01'),
], handleValidationErrors, async (req, res) => {
  try {
    const { fromToken, toToken, amount } = req.query;
    const userId = req.userId;

    logger.info('Enhanced swap rate request', {
      userId,
      fromToken,
      toToken,
      amount,
    });

    const rateResult = await tokenomicsService.getBestSwapRate(
      fromToken,
      toToken,
      parseFloat(amount),
      userId
    );

    if (rateResult.success) {
      res.status(200).json({
        success: true,
        data: rateResult.rate,
      });
    } else {
      res.status(400).json({
        success: false,
        error: rateResult.error,
      });
    }

  } catch (error) {
    logger.error('Enhanced swap rate request failed', {
      error: error.message,
      userId: req.userId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/tokenomics/liquidity/provide
 * Provisão de liquidez (placeholder)
 */
router.post('/liquidity/provide', extractUserId, [
  body('token')
    .isIn(['USDC', 'BRZ', 'EURC'])
    .withMessage('Invalid token'),
  body('amount')
    .isFloat({ min: 100 })
    .withMessage('Minimum liquidity provision is 100 tokens'),
], handleValidationErrors, async (req, res) => {
  try {
    const { token, amount } = req.body;
    const userId = req.userId;

    logger.info('Liquidity provision request', {
      userId,
      token,
      amount,
    });

    const result = await tokenomicsService.liquidityService.provideLiquidity(
      token,
      amount,
      userId
    );

    if (result.success) {
      // Recompensar provedor de liquidez
      const rewardResult = await tokenomicsService.rewardsService.distributeCapyCoins(
        userId,
        amount / 100 * 2, // 2 CAPY per 100 tokens
        'liquidity'
      );

      res.status(200).json({
        success: true,
        message: 'Liquidity provided successfully',
        data: {
          ...result,
          rewards: rewardResult,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }

  } catch (error) {
    logger.error('Liquidity provision failed', {
      error: error.message,
      userId: req.userId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/tokenomics/discount/calculate
 * Calcula desconto total para uma taxa
 */
router.get('/discount/calculate', extractUserId, [
  query('feeAmount')
    .isFloat({ min: 0 })
    .withMessage('Fee amount must be non-negative'),
], handleValidationErrors, async (req, res) => {
  try {
    const { feeAmount } = req.query;
    const userId = req.userId;

    const discount = await tokenomicsService.calculateTotalDiscount(
      userId,
      parseFloat(feeAmount)
    );

    if (discount.success) {
      res.status(200).json({
        success: true,
        data: discount,
      });
    } else {
      res.status(400).json({
        success: false,
        error: discount.error,
      });
    }

  } catch (error) {
    logger.error('Discount calculation failed', {
      error: error.message,
      userId: req.userId,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/tokenomics/leaderboard
 * Leaderboard de usuários por diferentes métricas
 */
router.get('/leaderboard', [
  query('metric')
    .optional()
    .isIn(['capy_coins', 'brcapy', 'total_rewards', 'referrals'])
    .withMessage('Invalid leaderboard metric'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
], handleValidationErrors, async (req, res) => {
  try {
    const metric = req.query.metric || 'capy_coins';
    const limit = parseInt(req.query.limit) || 20;

    logger.info('Leaderboard request', { metric, limit });

    // Mock leaderboard data
    const leaderboard = await this.generateMockLeaderboard(metric, limit);

    res.status(200).json({
      success: true,
      data: {
        metric,
        leaderboard,
        timestamp: new Date(),
      },
    });

  } catch (error) {
    logger.error('Leaderboard request failed', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/tokenomics/stats
 * Estatísticas globais de tokenomics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await tokenomicsService.getGlobalTokenomicsStats();

    res.status(200).json({
      success: true,
      data: stats,
    });

  } catch (error) {
    logger.error('Tokenomics stats request failed', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/tokenomics/webhook/transaction
 * Webhook interno para processar recompensas após transações
 */
router.post('/webhook/transaction', [
  body('transactionId')
    .isUUID()
    .withMessage('Invalid transaction ID'),
  body('userId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('User ID is required'),
  body('type')
    .isIn(['BOLETO_PAYMENT', 'CRYPTO_FIAT_EXCHANGE', 'SWAP'])
    .withMessage('Invalid transaction type'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be non-negative'),
  body('success')
    .isBoolean()
    .withMessage('Success status must be boolean'),
], handleValidationErrors, async (req, res) => {
  try {
    const transactionData = req.body;

    logger.info('Transaction rewards webhook received', transactionData);

    const result = await tokenomicsService.processTransactionRewards(transactionData);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Transaction rewards processed',
        data: result.rewards,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }

  } catch (error) {
    logger.error('Transaction rewards webhook failed', {
      error: error.message,
      transactionData: req.body,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Método auxiliar para gerar leaderboard mock
 */
async function generateMockLeaderboard(metric, limit) {
  const mockUsers = [
    { id: 'user1', name: 'Alice', capyCoins: 1250, brcapy: 5000, referrals: 15 },
    { id: 'user2', name: 'Bob', capyCoins: 980, brcapy: 3500, referrals: 8 },
    { id: 'user3', name: 'Carol', capyCoins: 750, brcapy: 2800, referrals: 12 },
    { id: 'user4', name: 'David', capyCoins: 650, brcapy: 4200, referrals: 6 },
    { id: 'user5', name: 'Eve', capyCoins: 520, brcapy: 1900, referrals: 20 },
  ];

  // Ordenar baseado na métrica
  const sortKey = metric === 'capy_coins' ? 'capyCoins' : 
                  metric === 'brcapy' ? 'brcapy' :
                  metric === 'referrals' ? 'referrals' : 'capyCoins';

  return mockUsers
    .sort((a, b) => b[sortKey] - a[sortKey])
    .slice(0, limit)
    .map((user, index) => ({
      rank: index + 1,
      userId: user.id,
      name: user.name,
      value: user[sortKey],
      metric,
    }));
}

module.exports = router; 