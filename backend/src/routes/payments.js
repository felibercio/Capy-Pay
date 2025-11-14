const express = require('express');
const { body, param, validationResult } = require('express-validator');
const StarkBankService = require('../services/StarkBankService');
const SupabaseService = require('../services/SupabaseService');
const DepositRegistryService = require('../services/DepositRegistryService');
const CapyCoinMintService = require('../services/CapyCoinMintService');
const LiquidityService = require('../services/LiquidityService');
const logger = require('../utils/logger');

const router = express.Router();
const starkBankService = new StarkBankService();
const supa = new SupabaseService();
const liquidityService = new LiquidityService();

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
  body('userAddress')
    .optional()
    .isString()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid userAddress format')
], handleValidationErrors, async (req, res) => {
  try {
    const { amount, description, userId, userAddress } = req.body;
    
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
      userId,
      userAddress
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
 * POST /api/payments/pix/simulate-credit
 * Simula um crédito PIX e insere em deposits (ambiente local)
 * DEV: se o corpo incluir userAddress e DepositRegistry estiver configurado,
 * também registra on-chain (evento PixDepositRecorded) sem necessidade de webhook.
 */
router.post('/pix/simulate-credit', [
  body('transactionId')
    .optional()
    .isString()
    .isLength({ min: 1 })
    .withMessage('transactionId must be a valid string'),
  body('userId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('User ID is required'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number')
    .toFloat(),
  body('description')
    .optional()
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('Description must be between 1 and 200 characters'),
  body('userAddress')
    .optional()
    .isString()
    .isLength({ min: 1 })
    .withMessage('userAddress must be a valid string'),
], handleValidationErrors, async (req, res) => {
  try {
    const { transactionId, userId, amount, description, userAddress } = req.body;

    // Verificar Supabase configurado
    if (!supa.url || !supa.serviceKey) {
      return res.status(503).json({
        success: false,
        error: 'Supabase is not configured in this environment',
      });
    }

    const amountInCents = Math.round(amount * 100);

    logger.info('PIX credit simulation request', {
      userId,
      amount: amountInCents,
      transactionId,
      ip: req.ip,
    });

    // DEV: garantir que o usuário exista para evitar violação de FK em deposits
    try {
      const existingUser = await supa.getUserProfileById(userId);
      if (!existingUser) {
        await supa.upsertUserProfile({
          id: userId,
          email: `${userId}@dev.local`,
          name: 'Dev User',
          picture: null,
          googleId: null,
          walletAddress: userAddress || null,
          referralCode: null,
          createdAt: new Date().toISOString(),
        });
        logger.info('Dev user profile upserted for PIX simulation', { userId });
      }
    } catch (uErr) {
      logger.warn('Could not upsert dev user for PIX simulation', { error: uErr.message, userId });
    }

    // Se houver transação associada, verificar existência e atualizar; senão ignorar para evitar FK
    let validTransactionId = null;
    if (transactionId) {
      try {
        const tx = await supa.getTransaction(transactionId);
        if (tx) {
          await supa.updateTransaction(transactionId, {
            status: 'confirmed',
            actual_amount: amountInCents,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          validTransactionId = transactionId;
        } else {
          logger.warn('Transaction not found; will insert deposit without transaction_id', { transactionId });
        }
      } catch (err) {
        logger.warn('Transaction not found or update failed in simulation', {
          transactionId,
          error: err.message,
        });
      }
    }

    // Inserir depósito
    const deposit = await supa.insertDeposit({
      transaction_id: validTransactionId,
      user_id: userId,
      method: 'pix',
      amount: amountInCents,
      currency: 'BRL',
      status: 'confirmed',
      credited_at: new Date().toISOString(),
      description: description || 'PIX credit simulation',
      metadata: { simulated: true },
      updated_at: new Date().toISOString(),
    });

    // DEV: registro on-chain direto quando houver userAddress e serviço configurado
    let onchainRegistry = null;
    try {
      const registry = new DepositRegistryService();
      if (registry.isConfigured && userAddress && amountInCents > 0) {
        // Usar o ID do depósito do Supabase se disponível; senão cair para transactionId
        const depositIdStr = (deposit && (deposit.id || deposit.transaction_id))
          ? String(deposit.id || deposit.transaction_id)
          : String(transactionId || `pix-sim-${userId}-${Date.now()}`);

        const externalId = transactionId || '';
        const regResult = await registry.recordPixDeposit(
          depositIdStr,
          userAddress,
          amountInCents,
          externalId
        );

        onchainRegistry = regResult.success
          ? { success: true, txHash: regResult.txHash }
          : { success: false, error: regResult.error };

        if (regResult.success) {
          logger.info('Onchain PIX deposit recorded (dev simulate-credit)', {
            depositIdStr,
            txHash: regResult.txHash,
          });
        } else {
          logger.warn('Onchain PIX deposit registry failed in dev simulate-credit', {
            error: regResult.error,
          });
        }
      } else {
        if (!registry.isConfigured) {
          logger.warn('DepositRegistryService not configured; skipping onchain dev registry');
        }
      }
    } catch (chainErr) {
      logger.error('Error while trying onchain dev registry in simulate-credit', {
        error: chainErr.message,
      });
      onchainRegistry = { success: false, error: chainErr.message };
    }

    // DEV: opcionalmente mintar CAPY com base no valor em BRL
    let capyMint = null;
    try {
      const capyPerBrlRaw = process.env.CAPY_PER_BRL;
      const capyPerBrl = capyPerBrlRaw ? Number(capyPerBrlRaw) : null;
      if (userAddress && capyPerBrl && !Number.isNaN(capyPerBrl)) {
        const amountBRL = amountInCents / 100; // centavos -> reais
        const capyAmount = amountBRL * capyPerBrl;

        const mintService = new CapyCoinMintService();
        const mintResult = await mintService.mintToUser(userAddress, capyAmount);

        if (mintResult.success) {
          capyMint = { success: true, capyAmount, txHash: mintResult.txHash };

          // Registrar mint no Supabase quando possível
          try {
            await supa.insertCapyMint({
              transaction_id: validTransactionId || deposit?.id || null,
              user_address: userAddress,
              capy_amount: capyAmount,
              tx_hash: mintResult.txHash,
              minted_at: new Date().toISOString(),
            });
          } catch (mintDbErr) {
            logger.warn('Could not insert CAPY mint record in Supabase', { error: mintDbErr.message });
          }
        } else {
          capyMint = { success: false, error: mintResult.error };
        }
      } else {
        if (!userAddress) {
          logger.warn('Skipping CAPY mint in simulation: missing userAddress');
        }
        if (!capyPerBrlRaw) {
          logger.warn('Skipping CAPY mint in simulation: CAPY_PER_BRL not set');
        }
      }
    } catch (mintErr) {
      logger.error('Error while trying CAPY mint in simulate-credit', { error: mintErr.message });
      capyMint = { success: false, error: mintErr.message };
    }

    res.status(201).json({
      success: true,
      message: 'PIX credit simulated and deposit recorded',
      data: deposit,
      ...(onchainRegistry ? { onchainRegistry } : {}),
      ...(capyMint ? { capyMint } : {}),
    });

  } catch (error) {
    logger.error('Error in PIX credit simulation endpoint', {
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

    const transaction = await starkBankService.getTransaction(id);

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
 * GET /api/payments/transaction/:id/mints
 * Lista mintagens CAPY da transação
 */
router.get('/transaction/:id/mints', [
  param('id')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Transaction ID is required'),
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Transaction mints lookup request', {
      transactionId: id,
      ip: req.ip,
    });

    const mints = await starkBankService.getCapyMintsByTransaction(id);

    res.json({
      success: true,
      data: mints,
      count: mints.length,
    });
  } catch (error) {
    logger.error('Error in transaction mints lookup endpoint', {
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

/**
 * POST /api/payments/usdc/simulate-credit
 * Simula um crédito em USDC e realiza mint de CAPY proporcional ao BRL via 1inch
 */
router.post('/usdc/simulate-credit', [
  body('userId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('User ID is required'),
  body('amount')
    .isFloat({ min: 0.000001 })
    .withMessage('Amount must be a positive number')
    .toFloat(),
  body('description')
    .optional()
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('Description must be between 1 and 200 characters'),
  body('userAddress')
    .optional()
    .isString()
    .isLength({ min: 1 })
    .withMessage('userAddress must be a valid string'),
], handleValidationErrors, async (req, res) => {
  try {
    const { userId, amount, description, userAddress } = req.body;

    // Verificar Supabase configurado
    if (!supa.url || !supa.serviceKey) {
      return res.status(503).json({
        success: false,
        error: 'Supabase is not configured in this environment',
      });
    }

    logger.info('USDC credit simulation request', {
      userId,
      amountUSDC: amount,
      ip: req.ip,
    });

    // Garantir usuário para evitar violação de FK
    try {
      const existingUser = await supa.getUserProfileById(userId);
      if (!existingUser) {
        await supa.upsertUserProfile({
          id: userId,
          email: `${userId}@dev.local`,
          name: 'Dev User',
          picture: null,
          googleId: null,
          walletAddress: userAddress || null,
          referralCode: null,
          createdAt: new Date().toISOString(),
        });
        logger.info('Dev user profile upserted for USDC simulation', { userId });
      }
    } catch (uErr) {
      logger.warn('Could not upsert dev user for USDC simulation', { error: uErr.message, userId });
    }

    // Inserir depósito em USDC (armazenar em micro-unidades como inteiro)
    const amountMicroUSDC = Math.round(amount * 1e6);
    const deposit = await supa.insertDeposit({
      transaction_id: null,
      user_id: userId,
      method: 'usdc',
      amount: amountMicroUSDC,
      currency: 'USDC',
      status: 'confirmed',
      credited_at: new Date().toISOString(),
      description: description || 'USDC credit simulation',
      metadata: { simulated: true, decimals: 6 },
      updated_at: new Date().toISOString(),
    });

    // Converter USDC → BRZ (BRL) via 1inch/LiquidityService, com opção de override por env
    let conversion = null;
    let amountBRL = null;
    const overrideRaw = process.env.USDC_BRL_RATE_OVERRIDE;
    const overrideRate = overrideRaw ? Number(overrideRaw) : null;
    try {
      const quote = await liquidityService.getBestRateForSwap('USDC', 'BRZ', amount);
      let usedRate = quote.rate;
      let usedOutput = quote.estimatedOutput;

      // Se override estiver definido, usar taxa fixa para dev/ambiente controlado
      if (overrideRate && !Number.isNaN(overrideRate)) {
        usedRate = overrideRate;
        usedOutput = amount * overrideRate;
        conversion = {
          source: 'override_env',
          rate: usedRate,
          estimatedOutputBRZ: usedOutput,
          strategy: 'override',
        };
      } else {
        conversion = {
          source: quote.source,
          rate: usedRate,
          estimatedOutputBRZ: usedOutput,
          strategy: quote.strategy,
        };
      }

      amountBRL = conversion.estimatedOutputBRZ; // BRZ ~ BRL
      logger.info('USDC→BRZ conversion', {
        userId,
        amountUSDC: amount,
        amountBRL,
        source: conversion.source,
        rate: conversion.rate,
      });
    } catch (convErr) {
      // Fallback para taxa mock se 1inch falhar
      const fallbackRate = (overrideRate && !Number.isNaN(overrideRate)) ? overrideRate : 5.3; // preferir override; senão, 5.3
      amountBRL = amount * fallbackRate;
      conversion = {
        source: (overrideRate ? 'override_env' : 'fallback_mock'),
        rate: fallbackRate,
        estimatedOutputBRZ: amountBRL,
      };
      logger.warn('USDC→BRZ conversion failed, using fallback/override', { error: convErr.message, rate: fallbackRate });
    }

    // Distribuir CAPY proporcional ao BRL (mint ou transfer, conforme config)
    let capyMint = null;
    try {
      const capyPerBrlRaw = process.env.CAPY_PER_BRL;
      const capyPerBrl = capyPerBrlRaw ? Number(capyPerBrlRaw) : 10; // padrão 10 CAPY/BRL
      if (userAddress && capyPerBrl && !Number.isNaN(capyPerBrl)) {
        const capyAmount = amountBRL * capyPerBrl;

        const mintService = new CapyCoinMintService();
        const distributionMode = (process.env.CAPY_DISTRIBUTION_MODE || 'mint').toLowerCase();
        const mintResult = distributionMode === 'transfer'
          ? await mintService.transferToUser(userAddress, capyAmount)
          : await mintService.mintToUser(userAddress, capyAmount);

        if (mintResult.success) {
          capyMint = { success: true, mode: distributionMode, capyAmount, txHash: mintResult.txHash };

          try {
            await supa.insertCapyMint({
              transaction_id: deposit?.id || null,
              user_address: userAddress,
              capy_amount: capyAmount,
              tx_hash: mintResult.txHash,
              minted_at: new Date().toISOString(),
            });
          } catch (mintDbErr) {
            logger.warn('Could not insert CAPY mint record in Supabase (USDC)', { error: mintDbErr.message });
          }
        } else {
          capyMint = { success: false, error: mintResult.error };
        }
      } else {
        if (!userAddress) {
          logger.warn('Skipping CAPY mint (USDC): missing userAddress');
        }
      }
    } catch (mintErr) {
      logger.error('Error while trying CAPY mint in USDC simulate-credit', { error: mintErr.message });
      capyMint = { success: false, error: mintErr.message };
    }

    res.status(201).json({
      success: true,
      message: 'USDC credit simulated and deposit recorded',
      data: deposit,
      conversion,
      ...(capyMint ? { capyMint } : {}),
    });
  } catch (error) {
    logger.error('Error in USDC credit simulation endpoint', {
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