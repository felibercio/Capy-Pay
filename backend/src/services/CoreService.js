const crypto = require('crypto');
const logger = require('../utils/logger');
const AuthService = require('./AuthService');
const WalletService = require('./WalletService');
const StarkBankService = require('./StarkBankService');
const BlockchainMonitorService = require('./BlockchainMonitorService');
const SwapService = require('./SwapService');
const IntegrationService = require('./IntegrationService');

/**
 * CoreService - Orquestrador central do Capy Pay
 * Coordena todos os fluxos de negócio entre microsserviços
 */
class CoreService {
  constructor() {
    // Inicializar serviços
    this.authService = new AuthService();
    this.walletService = new WalletService();
    this.starkBankService = new StarkBankService();
    this.blockchainService = new BlockchainMonitorService();
    this.swapService = new SwapService();
    this.integrationService = new IntegrationService();

    // Estado das transações em memória (em produção, usar Redis)
    this.transactions = new Map();
    this.operationTimeouts = new Map();

    // Configurações de timeout
    this.config = {
      depositTimeout: 30 * 60 * 1000, // 30 minutos
      swapTimeout: 5 * 60 * 1000,     // 5 minutos
      paymentTimeout: 10 * 60 * 1000, // 10 minutos
      maxRetries: 3,
      retryDelay: 5000, // 5 segundos
    };

    // Event listeners para comunicação entre serviços
    this.setupEventListeners();
  }

  /**
   * Configura listeners para eventos dos serviços
   */
  setupEventListeners() {
    // Eventos do BlockchainMonitorService
    if (this.blockchainService.on) {
      this.blockchainService.on('depositDetected', this.handleDepositDetected.bind(this));
      this.blockchainService.on('swapCompleted', this.handleSwapCompleted.bind(this));
    }

    // Eventos do StarkBankService
    if (this.starkBankService.on) {
      this.starkBankService.on('paymentCompleted', this.handlePaymentCompleted.bind(this));
      this.starkBankService.on('paymentFailed', this.handlePaymentFailed.bind(this));
    }
  }

  /**
   * FLUXO 1: Pagamento de Boleto com Cripto
   * @param {string} userId - ID do usuário
   * @param {Object} boletoData - Dados do boleto
   * @returns {Promise<Object>} Resultado da operação
   */
  async initiateBoletoPayment(userId, boletoData) {
    const transactionId = crypto.randomUUID();
    
    try {
      logger.info('Initiating boleto payment with crypto', {
        transactionId,
        userId,
        boletoValue: boletoData.amount,
        barcode: boletoData.barcode?.substring(0, 20) + '...',
      });

      // 1. Validar usuário e dados do boleto
      const user = await this.validateUser(userId);
      const validatedBoleto = await this.validateBoleto(boletoData);

      // 2. Criar registro de transação
      const transaction = await this.createTransaction({
        id: transactionId,
        userId,
        type: 'BOLETO_PAYMENT',
        status: 'INITIATED',
        data: {
          boleto: validatedBoleto,
          user: {
            id: user.id,
            email: user.email,
            walletAddress: user.walletAddress,
          },
          steps: {
            userValidation: 'COMPLETED',
            boletoValidation: 'COMPLETED',
            walletSetup: 'PENDING',
            pixGeneration: 'PENDING',
            depositMonitoring: 'PENDING',
            boletoPayment: 'PENDING',
          }
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.config.depositTimeout),
      });

      // 3. Obter endereço da carteira custodial
      const walletAddress = await this.walletService.getWalletAddress(userId);
      if (!walletAddress) {
        throw new Error('User wallet not found');
      }

      await this.updateTransactionStep(transactionId, 'walletSetup', 'COMPLETED', {
        walletAddress,
      });

      // 4. Gerar PIX cobrança dinâmico para identificação
      const pixData = await this.starkBankService.generatePixQrCode({
        amount: validatedBoleto.amount,
        description: `Pagamento de boleto - ${validatedBoleto.barcode}`,
        expiration: 30 * 60, // 30 minutos
        tags: [`boleto:${transactionId}`, `user:${userId}`],
      });

      await this.updateTransactionStep(transactionId, 'pixGeneration', 'COMPLETED', {
        pixCode: pixData.qrCode,
        pixId: pixData.id,
      });

      // 5. Configurar monitoramento de depósito
      await this.blockchainService.addDepositWatch({
        transactionId,
        userWalletAddress: walletAddress,
        expectedAmount: validatedBoleto.amount,
        tokenTypes: ['USDC', 'BRZ', 'EURC'],
        timeout: this.config.depositTimeout,
      });

      await this.updateTransactionStep(transactionId, 'depositMonitoring', 'ACTIVE');

      // 6. Configurar timeout para a transação
      this.setTransactionTimeout(transactionId, this.config.depositTimeout);

      logger.info('Boleto payment initiated successfully', {
        transactionId,
        userId,
        walletAddress,
        pixId: pixData.id,
      });

      return {
        success: true,
        transactionId,
        data: {
          walletAddress,
          depositInstructions: {
            message: 'Deposite stablecoins (USDC, BRZ ou EURC) no endereço abaixo',
            address: walletAddress,
            network: 'Base',
            supportedTokens: ['USDC', 'BRZ', 'EURC'],
            amount: validatedBoleto.amount,
            timeout: '30 minutos',
          },
          boleto: {
            barcode: validatedBoleto.barcode,
            amount: validatedBoleto.amount,
            dueDate: validatedBoleto.dueDate,
            recipient: validatedBoleto.recipient,
          },
          pix: {
            code: pixData.qrCode,
            id: pixData.id,
          },
          expiresAt: transaction.expiresAt,
        },
      };

    } catch (error) {
      logger.error('Failed to initiate boleto payment', {
        error: error.message,
        stack: error.stack,
        transactionId,
        userId,
      });

      await this.failTransaction(transactionId, error.message);

      return {
        success: false,
        error: error.message,
        transactionId,
      };
    }
  }

  /**
   * FLUXO 2: Câmbio (Stablecoin para Fiat)
   * @param {string} userId - ID do usuário
   * @param {Object} exchangeData - Dados do câmbio
   * @returns {Promise<Object>} Resultado da operação
   */
  async initiateExchange(userId, exchangeData) {
    const transactionId = crypto.randomUUID();

    try {
      logger.info('Initiating crypto to fiat exchange', {
        transactionId,
        userId,
        fromToken: exchangeData.fromToken,
        toFiat: exchangeData.toFiat,
        amount: exchangeData.amount,
      });

      // 1. Validar usuário e dados do câmbio
      const user = await this.validateUser(userId);
      const validatedExchange = await this.validateExchange(exchangeData);

      // 2. Criar registro de transação
      const transaction = await this.createTransaction({
        id: transactionId,
        userId,
        type: 'CRYPTO_FIAT_EXCHANGE',
        status: 'INITIATED',
        data: {
          exchange: validatedExchange,
          user: {
            id: user.id,
            email: user.email,
            walletAddress: user.walletAddress,
          },
          steps: {
            userValidation: 'COMPLETED',
            exchangeValidation: 'COMPLETED',
            walletSetup: 'PENDING',
            depositMonitoring: 'PENDING',
            swapExecution: 'PENDING',
            fiatWithdrawal: 'PENDING',
          }
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.config.depositTimeout),
      });

      // 3. Obter endereço da carteira custodial
      const walletAddress = await this.walletService.getWalletAddress(userId);
      if (!walletAddress) {
        throw new Error('User wallet not found');
      }

      await this.updateTransactionStep(transactionId, 'walletSetup', 'COMPLETED', {
        walletAddress,
      });

      // 4. Calcular taxa de câmbio e valores
      const exchangeRate = await this.calculateExchangeRate(
        validatedExchange.fromToken,
        validatedExchange.toFiat
      );

      const fiatAmount = validatedExchange.amount * exchangeRate.rate;
      const fees = this.calculateFees(validatedExchange.amount, 'EXCHANGE');
      const netAmount = fiatAmount - fees.total;

      // 5. Configurar monitoramento de depósito
      await this.blockchainService.addDepositWatch({
        transactionId,
        userWalletAddress: walletAddress,
        expectedAmount: validatedExchange.amount,
        tokenTypes: [validatedExchange.fromToken],
        timeout: this.config.depositTimeout,
      });

      await this.updateTransactionStep(transactionId, 'depositMonitoring', 'ACTIVE');

      // 6. Configurar timeout para a transação
      this.setTransactionTimeout(transactionId, this.config.depositTimeout);

      logger.info('Exchange initiated successfully', {
        transactionId,
        userId,
        walletAddress,
        exchangeRate: exchangeRate.rate,
        fiatAmount,
        netAmount,
      });

      return {
        success: true,
        transactionId,
        data: {
          walletAddress,
          depositInstructions: {
            message: `Deposite ${validatedExchange.fromToken} no endereço abaixo`,
            address: walletAddress,
            network: 'Base',
            token: validatedExchange.fromToken,
            amount: validatedExchange.amount,
            timeout: '30 minutos',
          },
          exchange: {
            fromToken: validatedExchange.fromToken,
            toFiat: validatedExchange.toFiat,
            amount: validatedExchange.amount,
            exchangeRate: exchangeRate.rate,
            fiatAmount,
            fees: fees,
            netAmount,
            withdrawalMethod: validatedExchange.withdrawalMethod,
            withdrawalData: validatedExchange.withdrawalData,
          },
          expiresAt: transaction.expiresAt,
        },
      };

    } catch (error) {
      logger.error('Failed to initiate exchange', {
        error: error.message,
        stack: error.stack,
        transactionId,
        userId,
      });

      await this.failTransaction(transactionId, error.message);

      return {
        success: false,
        error: error.message,
        transactionId,
      };
    }
  }

  /**
   * Handler para depósito detectado
   */
  async handleDepositDetected(depositData) {
    const { transactionId, amount, token, txHash } = depositData;

    try {
      logger.info('Deposit detected for transaction', {
        transactionId,
        amount,
        token,
        txHash,
      });

      const transaction = this.transactions.get(transactionId);
      if (!transaction) {
        logger.error('Transaction not found for deposit', { transactionId });
        return;
      }

      // Atualizar transação com dados do depósito
      await this.updateTransaction(transactionId, {
        'data.deposit': {
          amount,
          token,
          txHash,
          detectedAt: new Date(),
        },
      });

      // Processar baseado no tipo de transação
      if (transaction.type === 'BOLETO_PAYMENT') {
        await this.processBoletoAfterDeposit(transactionId, depositData);
      } else if (transaction.type === 'CRYPTO_FIAT_EXCHANGE') {
        await this.processExchangeAfterDeposit(transactionId, depositData);
      }

    } catch (error) {
      logger.error('Error handling deposit detection', {
        error: error.message,
        transactionId,
        depositData,
      });

      await this.failTransaction(transactionId, `Deposit processing failed: ${error.message}`);
    }
  }

  /**
   * Processa pagamento de boleto após depósito
   */
  async processBoletoAfterDeposit(transactionId, depositData) {
    try {
      logger.info('Processing boleto payment after deposit', {
        transactionId,
        depositData,
      });

      const transaction = this.transactions.get(transactionId);
      const boletoData = transaction.data.boleto;

      // 1. Se necessário, fazer swap para BRZ
      let paymentAmount = depositData.amount;
      if (depositData.token !== 'BRZ') {
        logger.info('Swapping to BRZ for boleto payment', {
          transactionId,
          fromToken: depositData.token,
          amount: depositData.amount,
        });

        await this.updateTransactionStep(transactionId, 'swapExecution', 'IN_PROGRESS');

        const swapResult = await this.swapService.executeSwap({
          fromToken: depositData.token,
          toToken: 'BRZ',
          amount: depositData.amount,
          slippage: 0.5, // 0.5%
        });

        if (!swapResult.success) {
          throw new Error(`Swap failed: ${swapResult.error}`);
        }

        paymentAmount = swapResult.outputAmount;
        
        await this.updateTransactionStep(transactionId, 'swapExecution', 'COMPLETED', {
          swapTxHash: swapResult.transactionHash,
          outputAmount: paymentAmount,
        });
      }

      // 2. Pagar boleto via StarkBank
      await this.updateTransactionStep(transactionId, 'boletoPayment', 'IN_PROGRESS');

      const paymentResult = await this.starkBankService.payBill({
        barcode: boletoData.barcode,
        amount: boletoData.amount,
        description: `Pagamento via Capy Pay - ${transactionId}`,
        tags: [`transaction:${transactionId}`, `user:${transaction.userId}`],
      });

      if (paymentResult.success) {
        await this.updateTransactionStep(transactionId, 'boletoPayment', 'COMPLETED', {
          paymentId: paymentResult.payment.id,
          paidAt: new Date(),
        });

        await this.completeTransaction(transactionId, 'Boleto paid successfully');

        logger.info('Boleto payment completed successfully', {
          transactionId,
          paymentId: paymentResult.payment.id,
        });
      } else {
        throw new Error(`Payment failed: ${paymentResult.error}`);
      }

    } catch (error) {
      logger.error('Error processing boleto after deposit', {
        error: error.message,
        transactionId,
      });

      await this.failTransaction(transactionId, `Boleto payment failed: ${error.message}`);
    }
  }

  /**
   * Processa câmbio após depósito
   */
  async processExchangeAfterDeposit(transactionId, depositData) {
    try {
      logger.info('Processing exchange after deposit', {
        transactionId,
        depositData,
      });

      const transaction = this.transactions.get(transactionId);
      const exchangeData = transaction.data.exchange;

      // 1. Fazer swap se necessário
      let finalAmount = depositData.amount;
      let finalToken = depositData.token;

      if (this.needsSwapForFiat(depositData.token, exchangeData.toFiat)) {
        const targetToken = this.getTargetTokenForFiat(exchangeData.toFiat);
        
        logger.info('Swapping for fiat exchange', {
          transactionId,
          fromToken: depositData.token,
          toToken: targetToken,
          amount: depositData.amount,
        });

        await this.updateTransactionStep(transactionId, 'swapExecution', 'IN_PROGRESS');

        const swapResult = await this.swapService.executeSwap({
          fromToken: depositData.token,
          toToken: targetToken,
          amount: depositData.amount,
          slippage: 0.5,
        });

        if (!swapResult.success) {
          throw new Error(`Swap failed: ${swapResult.error}`);
        }

        finalAmount = swapResult.outputAmount;
        finalToken = targetToken;

        await this.updateTransactionStep(transactionId, 'swapExecution', 'COMPLETED', {
          swapTxHash: swapResult.transactionHash,
          outputAmount: finalAmount,
          outputToken: finalToken,
        });
      }

      // 2. Executar saque fiat
      await this.updateTransactionStep(transactionId, 'fiatWithdrawal', 'IN_PROGRESS');

      let withdrawalResult;
      if (exchangeData.toFiat === 'BRL') {
        // PIX via StarkBank
        withdrawalResult = await this.starkBankService.sendPix({
          amount: finalAmount,
          pixKey: exchangeData.withdrawalData.pixKey,
          description: `Saque Capy Pay - ${transactionId}`,
          tags: [`transaction:${transactionId}`, `user:${transaction.userId}`],
        });
      } else {
        // USD/EUR via FiatWithdrawalService (placeholder)
        withdrawalResult = await this.executeFiatWithdrawal({
          amount: finalAmount,
          currency: exchangeData.toFiat,
          withdrawalData: exchangeData.withdrawalData,
          transactionId,
        });
      }

      if (withdrawalResult.success) {
        await this.updateTransactionStep(transactionId, 'fiatWithdrawal', 'COMPLETED', {
          withdrawalId: withdrawalResult.id,
          sentAt: new Date(),
        });

        await this.completeTransaction(transactionId, 'Exchange completed successfully');

        logger.info('Exchange completed successfully', {
          transactionId,
          withdrawalId: withdrawalResult.id,
        });
      } else {
        throw new Error(`Withdrawal failed: ${withdrawalResult.error}`);
      }

    } catch (error) {
      logger.error('Error processing exchange after deposit', {
        error: error.message,
        transactionId,
      });

      await this.failTransaction(transactionId, `Exchange processing failed: ${error.message}`);
    }
  }

  /**
   * Obtém status de uma transação
   */
  async getTransactionStatus(transactionId) {
    try {
      const transaction = this.transactions.get(transactionId);
      
      if (!transaction) {
        return {
          success: false,
          error: 'Transaction not found',
        };
      }

      return {
        success: true,
        data: {
          id: transaction.id,
          type: transaction.type,
          status: transaction.status,
          steps: transaction.data.steps,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
          expiresAt: transaction.expiresAt,
          // Incluir dados específicos baseado no tipo
          ...(transaction.type === 'BOLETO_PAYMENT' && {
            boleto: transaction.data.boleto,
            deposit: transaction.data.deposit,
          }),
          ...(transaction.type === 'CRYPTO_FIAT_EXCHANGE' && {
            exchange: transaction.data.exchange,
            deposit: transaction.data.deposit,
          }),
        },
      };

    } catch (error) {
      logger.error('Error getting transaction status', {
        error: error.message,
        transactionId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Lista transações do usuário
   */
  async getUserTransactions(userId, limit = 50, offset = 0) {
    try {
      const userTransactions = Array.from(this.transactions.values())
        .filter(tx => tx.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(offset, offset + limit)
        .map(tx => ({
          id: tx.id,
          type: tx.type,
          status: tx.status,
          createdAt: tx.createdAt,
          updatedAt: tx.updatedAt,
          // Dados resumidos por tipo
          ...(tx.type === 'BOLETO_PAYMENT' && {
            amount: tx.data.boleto.amount,
            barcode: tx.data.boleto.barcode?.substring(0, 20) + '...',
          }),
          ...(tx.type === 'CRYPTO_FIAT_EXCHANGE' && {
            fromToken: tx.data.exchange.fromToken,
            toFiat: tx.data.exchange.toFiat,
            amount: tx.data.exchange.amount,
          }),
        }));

      return {
        success: true,
        data: {
          transactions: userTransactions,
          total: userTransactions.length,
          limit,
          offset,
        },
      };

    } catch (error) {
      logger.error('Error getting user transactions', {
        error: error.message,
        userId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Métodos auxiliares continuam no próximo bloco...
  
  /**
   * Valida usuário
   */
  async validateUser(userId) {
    // TODO: Implementar validação completa
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Verificar se usuário existe e está ativo
    const user = { id: userId, email: 'user@example.com', walletAddress: '0x...' };
    return user;
  }

  /**
   * Valida dados do boleto
   */
  async validateBoleto(boletoData) {
    if (!boletoData.barcode || !boletoData.amount) {
      throw new Error('Barcode and amount are required');
    }

    if (boletoData.amount <= 0) {
      throw new Error('Amount must be positive');
    }

    // TODO: Validar código de barras
    return {
      barcode: boletoData.barcode,
      amount: parseFloat(boletoData.amount),
      dueDate: boletoData.dueDate,
      recipient: boletoData.recipient || 'Unknown',
    };
  }

  /**
   * Valida dados do câmbio
   */
  async validateExchange(exchangeData) {
    const supportedTokens = ['USDC', 'BRZ', 'EURC'];
    const supportedFiats = ['BRL', 'USD', 'EUR'];

    if (!supportedTokens.includes(exchangeData.fromToken)) {
      throw new Error('Unsupported source token');
    }

    if (!supportedFiats.includes(exchangeData.toFiat)) {
      throw new Error('Unsupported target fiat');
    }

    if (!exchangeData.amount || exchangeData.amount <= 0) {
      throw new Error('Amount must be positive');
    }

    return {
      fromToken: exchangeData.fromToken,
      toFiat: exchangeData.toFiat,
      amount: parseFloat(exchangeData.amount),
      withdrawalMethod: exchangeData.withdrawalMethod,
      withdrawalData: exchangeData.withdrawalData,
    };
  }

  /**
   * Cria nova transação
   */
  async createTransaction(transactionData) {
    const transaction = {
      ...transactionData,
      updatedAt: new Date(),
    };

    this.transactions.set(transactionData.id, transaction);
    
    logger.info('Transaction created', {
      transactionId: transactionData.id,
      type: transactionData.type,
      userId: transactionData.userId,
    });

    return transaction;
  }

  /**
   * Atualiza step da transação
   */
  async updateTransactionStep(transactionId, stepName, status, data = {}) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    transaction.data.steps[stepName] = status;
    transaction.updatedAt = new Date();

    // Adicionar dados específicos do step
    if (Object.keys(data).length > 0) {
      transaction.data[stepName + 'Data'] = data;
    }

    this.transactions.set(transactionId, transaction);

    logger.info('Transaction step updated', {
      transactionId,
      stepName,
      status,
      data,
    });
  }

  /**
   * Atualiza transação
   */
  async updateTransaction(transactionId, updates) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Aplicar updates usando dot notation
    for (const [path, value] of Object.entries(updates)) {
      this.setNestedProperty(transaction, path, value);
    }

    transaction.updatedAt = new Date();
    this.transactions.set(transactionId, transaction);
  }

  /**
   * Completa transação com sucesso
   */
  async completeTransaction(transactionId, message) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    transaction.status = 'COMPLETED';
    transaction.completedAt = new Date();
    transaction.message = message;
    transaction.updatedAt = new Date();

    this.transactions.set(transactionId, transaction);

    // Limpar timeout
    this.clearTransactionTimeout(transactionId);

    logger.info('Transaction completed', {
      transactionId,
      message,
    });
  }

  /**
   * Falha transação
   */
  async failTransaction(transactionId, error) {
    const transaction = this.transactions.get(transactionId);
    if (transaction) {
      transaction.status = 'FAILED';
      transaction.error = error;
      transaction.failedAt = new Date();
      transaction.updatedAt = new Date();

      this.transactions.set(transactionId, transaction);
    }

    // Limpar timeout
    this.clearTransactionTimeout(transactionId);

    logger.error('Transaction failed', {
      transactionId,
      error,
    });
  }

  /**
   * Configura timeout para transação
   */
  setTransactionTimeout(transactionId, timeoutMs) {
    const timeoutId = setTimeout(async () => {
      await this.failTransaction(transactionId, 'Transaction timeout');
    }, timeoutMs);

    this.operationTimeouts.set(transactionId, timeoutId);
  }

  /**
   * Limpa timeout da transação
   */
  clearTransactionTimeout(transactionId) {
    const timeoutId = this.operationTimeouts.get(transactionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.operationTimeouts.delete(transactionId);
    }
  }

  /**
   * Métodos auxiliares para câmbio
   */
  async calculateExchangeRate(fromToken, toFiat) {
    // TODO: Integrar com API de cotação real
    const mockRates = {
      'USDC-BRL': 5.2,
      'BRZ-BRL': 1.0,
      'EURC-EUR': 1.0,
      'USDC-USD': 1.0,
    };

    const rateKey = `${fromToken}-${toFiat}`;
    const rate = mockRates[rateKey] || 1.0;

    return {
      rate,
      source: 'mock',
      timestamp: new Date(),
    };
  }

  calculateFees(amount, operationType) {
    // TODO: Implementar cálculo real de taxas
    const feePercentage = operationType === 'EXCHANGE' ? 0.005 : 0.003; // 0.5% ou 0.3%
    const fee = amount * feePercentage;

    return {
      percentage: feePercentage,
      amount: fee,
      total: fee,
    };
  }

  needsSwapForFiat(token, fiat) {
    const directPairs = {
      'BRZ': ['BRL'],
      'EURC': ['EUR'],
      'USDC': ['USD'],
    };

    return !directPairs[token]?.includes(fiat);
  }

  getTargetTokenForFiat(fiat) {
    const fiatToToken = {
      'BRL': 'BRZ',
      'EUR': 'EURC',
      'USD': 'USDC',
    };

    return fiatToToken[fiat] || 'USDC';
  }

  /**
   * Placeholder para FiatWithdrawalService
   */
  async executeFiatWithdrawal(withdrawalData) {
    // TODO: Implementar FiatWithdrawalService
    logger.info('Executing fiat withdrawal (placeholder)', withdrawalData);

    return {
      success: true,
      id: crypto.randomUUID(),
      message: 'Withdrawal processed (mock)',
    };
  }

  /**
   * Utilitário para set nested property
   */
  setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Obtém estatísticas do CoreService
   */
  getStats() {
    const transactions = Array.from(this.transactions.values());
    
    const stats = {
      totalTransactions: transactions.length,
      activeTransactions: transactions.filter(tx => 
        ['INITIATED', 'IN_PROGRESS'].includes(tx.status)
      ).length,
      completedTransactions: transactions.filter(tx => 
        tx.status === 'COMPLETED'
      ).length,
      failedTransactions: transactions.filter(tx => 
        tx.status === 'FAILED'
      ).length,
      transactionsByType: {},
      activeTimeouts: this.operationTimeouts.size,
    };

    // Contar por tipo
    transactions.forEach(tx => {
      stats.transactionsByType[tx.type] = 
        (stats.transactionsByType[tx.type] || 0) + 1;
    });

    return stats;
  }
}

module.exports = CoreService; 