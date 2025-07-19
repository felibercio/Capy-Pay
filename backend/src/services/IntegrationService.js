const logger = require('../utils/logger');
const BlockchainMonitorService = require('./BlockchainMonitorService');
const SwapService = require('./SwapService');
const StarkBankService = require('./StarkBankService');

/**
 * Serviço de integração entre blockchain e pagamentos
 * Orquestra fluxos completos de depósito → swap → pagamento
 */
class IntegrationService {
  constructor() {
    this.blockchainMonitor = new BlockchainMonitorService();
    this.swapService = new SwapService();
    this.starkBankService = new StarkBankService();
    
    this.isInitialized = false;
  }

  /**
   * Inicializa o serviço de integração
   */
  async initialize() {
    try {
      logger.info('Initializing integration service');

      // Inicializar monitoramento blockchain
      await this.blockchainMonitor.startMonitoring();

      // Configurar listeners para eventos
      this.setupEventHandlers();

      this.isInitialized = true;
      logger.info('Integration service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize integration service', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Configura handlers para eventos
   */
  setupEventHandlers() {
    // TODO: Implementar event emitters nos serviços
    logger.info('Setting up integration event handlers');
    
    // Exemplo de como seria a integração:
    // this.blockchainMonitor.on('deposit_confirmed', this.handleDepositConfirmed.bind(this));
    // this.swapService.on('swap_completed', this.handleSwapCompleted.bind(this));
  }

  /**
   * Processa fluxo completo: Depósito → Swap → Pagamento
   * @param {Object} params - Parâmetros do fluxo
   * @returns {Promise<Object>} Resultado do processamento
   */
  async processPaymentFlow(params) {
    const {
      depositAmount,
      depositToken,
      targetCurrency,
      paymentType, // 'pix' ou 'boleto'
      paymentDetails, // chave PIX ou código de barras
      userId,
    } = params;

    const flowId = `flow_${Date.now()}_${userId}`;

    try {
      logger.info('Starting payment flow', {
        flowId,
        depositAmount,
        depositToken,
        targetCurrency,
        paymentType,
        userId,
      });

      // 1. Verificar se há saldo suficiente
      const balance = await this.blockchainMonitor.getTokenBalance(depositToken);
      if (parseFloat(balance.balance) < parseFloat(depositAmount)) {
        throw new Error(`Insufficient balance: ${balance.balance} ${depositToken}`);
      }

      // 2. Calcular necessidade de swap
      const swapNeeded = this.shouldSwap(depositToken, targetCurrency);
      let finalToken = depositToken;
      let finalAmount = depositAmount;

      if (swapNeeded) {
        // 3. Executar swap se necessário
        const targetToken = this.getTargetToken(targetCurrency);
        
        logger.info('Swap required for payment flow', {
          flowId,
          fromToken: depositToken,
          toToken: targetToken,
          amount: depositAmount,
        });

        const swapResult = await this.swapService.executeSwap(
          depositToken,
          targetToken,
          depositAmount,
          process.env.BASE_PRIVATE_KEY,
          {
            flowId,
            purpose: 'payment_conversion',
            userId,
          }
        );

        if (!swapResult.success) {
          throw new Error(`Swap failed: ${swapResult.error}`);
        }

        finalToken = targetToken;
        finalAmount = swapResult.toAmount;

        logger.info('Swap completed in payment flow', {
          flowId,
          swapTxHash: swapResult.txHash,
          finalAmount,
          finalToken,
        });
      }

      // 4. Processar pagamento via StarkBank
      let paymentResult;

      if (paymentType === 'pix') {
        // Para PIX, gerar QR code (usuário faz o pagamento)
        paymentResult = await this.starkBankService.generatePixQrCode(
          Math.round(parseFloat(finalAmount) * 100), // converter para centavos
          `Pagamento Capy Pay - Flow ${flowId}`,
          userId
        );
      } else if (paymentType === 'boleto') {
        // Para boleto, executar pagamento
        paymentResult = await this.starkBankService.payBill(
          paymentDetails, // código de barras
          Math.round(parseFloat(finalAmount) * 100), // converter para centavos
          userId
        );
      }

      if (!paymentResult.success) {
        throw new Error(`Payment processing failed: ${paymentResult.error}`);
      }

      // 5. Registrar fluxo completo
      const flowData = {
        id: flowId,
        userId,
        status: 'completed',
        steps: {
          deposit: {
            token: depositToken,
            amount: depositAmount,
            status: 'confirmed',
          },
          swap: swapNeeded ? {
            fromToken: depositToken,
            toToken: finalToken,
            fromAmount: depositAmount,
            toAmount: finalAmount,
            txHash: swapResult?.txHash,
            status: 'completed',
          } : null,
          payment: {
            type: paymentType,
            amount: finalAmount,
            currency: targetCurrency,
            details: paymentResult.data,
            status: 'processed',
          },
        },
        createdAt: new Date(),
        completedAt: new Date(),
      };

      await this.saveFlow(flowData);

      logger.info('Payment flow completed successfully', {
        flowId,
        finalAmount,
        paymentType,
      });

      return {
        success: true,
        flowId,
        data: flowData,
      };

    } catch (error) {
      logger.error('Payment flow failed', {
        error: error.message,
        flowId,
        userId,
      });

      // Registrar falha
      await this.saveFlow({
        id: flowId,
        userId,
        status: 'failed',
        error: error.message,
        createdAt: new Date(),
        failedAt: new Date(),
      });

      return {
        success: false,
        flowId,
        error: error.message,
      };
    }
  }

  /**
   * Determina se swap é necessário
   */
  shouldSwap(depositToken, targetCurrency) {
    const swapRules = {
      'BRL': ['BRZ'], // Para BRL, aceita BRZ diretamente
      'USD': ['USDC'], // Para USD, aceita USDC diretamente
      'EUR': ['EURC'], // Para EUR, aceita EURC diretamente
    };

    const acceptableTokens = swapRules[targetCurrency] || [];
    return !acceptableTokens.includes(depositToken);
  }

  /**
   * Obtém token alvo para moeda fiat
   */
  getTargetToken(targetCurrency) {
    const tokenMap = {
      'BRL': 'BRZ',
      'USD': 'USDC',
      'EUR': 'EURC',
    };

    return tokenMap[targetCurrency] || 'USDC';
  }

  /**
   * Processa notificação de depósito confirmado
   */
  async handleDepositConfirmed(depositData) {
    try {
      logger.info('Handling confirmed deposit', {
        depositId: depositData.id,
        token: depositData.token,
        amount: depositData.amount,
      });

      // Verificar se há pagamentos pendentes para este usuário
      const pendingPayments = await this.getPendingPayments(depositData.from);

      if (pendingPayments.length > 0) {
        logger.info('Found pending payments for user', {
          userAddress: depositData.from,
          pendingCount: pendingPayments.length,
        });

        // Processar primeiro pagamento pendente
        const payment = pendingPayments[0];
        await this.processPaymentFlow({
          depositAmount: depositData.amount,
          depositToken: depositData.token,
          targetCurrency: payment.currency,
          paymentType: payment.type,
          paymentDetails: payment.details,
          userId: payment.userId,
        });
      }

    } catch (error) {
      logger.error('Error handling confirmed deposit', {
        error: error.message,
        depositId: depositData.id,
      });
    }
  }

  /**
   * Obtém pagamentos pendentes para usuário
   */
  async getPendingPayments(userAddress) {
    // TODO: Implementar busca real no banco
    logger.info('Getting pending payments (placeholder)', { userAddress });
    return []; // Placeholder
  }

  /**
   * Salva fluxo de pagamento
   */
  async saveFlow(flowData) {
    // TODO: Implementar persistência real
    logger.info('Saving payment flow (placeholder)', {
      flowId: flowData.id,
      status: flowData.status,
    });

    // Placeholder em memória
    if (!global.paymentFlows) {
      global.paymentFlows = new Map();
    }
    global.paymentFlows.set(flowData.id, flowData);
  }

  /**
   * Obtém fluxo por ID
   */
  getFlow(flowId) {
    if (global.paymentFlows && global.paymentFlows.has(flowId)) {
      return global.paymentFlows.get(flowId);
    }
    return null;
  }

  /**
   * Lista fluxos de pagamento
   */
  getFlowHistory(userId = null, limit = 50) {
    if (!global.paymentFlows) {
      return [];
    }

    let flows = Array.from(global.paymentFlows.values());

    if (userId) {
      flows = flows.filter(flow => flow.userId === userId);
    }

    return flows
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  /**
   * Calcula taxas totais para um fluxo
   */
  async calculateFlowFees(params) {
    const {
      depositAmount,
      depositToken,
      targetCurrency,
      paymentType,
    } = params;

    try {
      let totalFees = {
        swapFee: 0,
        paymentFee: 0,
        total: 0,
        currency: targetCurrency,
      };

      // Calcular taxa de swap se necessário
      if (this.shouldSwap(depositToken, targetCurrency)) {
        const targetToken = this.getTargetToken(targetCurrency);
        const quote = await this.swapService.getBestRoute(
          depositToken,
          targetToken,
          depositAmount
        );

        // Estimar taxa baseada na diferença entre input e output
        const inputValue = parseFloat(depositAmount);
        const outputValue = parseFloat(quote.toAmount);
        const impliedRate = outputValue / inputValue;
        
        // Taxa de swap aproximada (diferença do valor esperado)
        totalFees.swapFee = Math.max(0, inputValue * 0.003); // ~0.3% estimado
      }

      // Taxa de pagamento
      if (paymentType === 'pix') {
        totalFees.paymentFee = parseFloat(depositAmount) * 0.01; // 1%
      } else if (paymentType === 'boleto') {
        totalFees.paymentFee = parseFloat(depositAmount) * 0.005; // 0.5%
      }

      totalFees.total = totalFees.swapFee + totalFees.paymentFee;

      return {
        success: true,
        fees: totalFees,
      };

    } catch (error) {
      logger.error('Error calculating flow fees', {
        error: error.message,
        params,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verifica status do serviço de integração
   */
  async getIntegrationStatus() {
    try {
      const [blockchainStatus, swapStatus] = await Promise.all([
        this.blockchainMonitor.getServiceStatus(),
        this.swapService.getServiceStatus(),
      ]);

      return {
        isInitialized: this.isInitialized,
        services: {
          blockchain: blockchainStatus,
          swap: swapStatus,
        },
        flows: {
          total: global.paymentFlows ? global.paymentFlows.size : 0,
          active: this.getFlowHistory().filter(f => f.status === 'processing').length,
          completed: this.getFlowHistory().filter(f => f.status === 'completed').length,
          failed: this.getFlowHistory().filter(f => f.status === 'failed').length,
        },
      };

    } catch (error) {
      logger.error('Error getting integration status', {
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = IntegrationService; 