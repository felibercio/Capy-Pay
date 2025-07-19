const starkbank = require('starkbank');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class StarkBankService {
  constructor() {
    this.initializeStarkBank();
  }

  /**
   * Inicializa a configuração do StarkBank
   */
  initializeStarkBank() {
    try {
      // Configurar credenciais
      const projectId = process.env.STARKBANK_PROJECT_ID;
      const privateKeyPath = process.env.STARKBANK_PRIVATE_KEY_PATH;
      const environment = process.env.STARKBANK_ENVIRONMENT || 'sandbox';

      if (!projectId || !privateKeyPath) {
        throw new Error('StarkBank credentials not configured');
      }

      // Ler chave privada
      const privateKeyContent = fs.readFileSync(path.resolve(privateKeyPath), 'utf8');

      // Configurar usuário do StarkBank
      const user = new starkbank.Project({
        environment: environment,
        id: projectId,
        privateKey: privateKeyContent,
      });

      starkbank.user = user;

      logger.info('StarkBank initialized successfully', {
        environment,
        projectId,
      });
    } catch (error) {
      logger.error('Failed to initialize StarkBank', { error: error.message });
      throw error;
    }
  }

  /**
   * Gera um QR Code PIX dinâmico para recebimento
   * @param {number} value - Valor em centavos (R$ 10.00 = 1000)
   * @param {string} description - Descrição do pagamento
   * @param {string} userId - ID do usuário no sistema
   * @returns {Promise<Object>} Dados do PIX gerado
   */
  async generatePixQrCode(value, description, userId) {
    try {
      logger.info('Generating PIX QR Code', { value, description, userId });

      // Criar cobrança PIX dinâmica
      const pixRequest = new starkbank.DynamicBrcode({
        name: 'Capy Pay',
        city: 'São Paulo',
        externalId: `capy-${userId}-${uuidv4()}`,
        amount: value,
        expiration: 3600, // 1 hora
        tags: [
          `user:${userId}`,
          'capy-pay',
          'deposit',
        ],
      });

      const dynamicBrcodes = await starkbank.dynamicBrcode.create([pixRequest]);
      const brcode = dynamicBrcodes[0];

      // TODO: Salvar no banco de dados
      const transactionData = {
        id: brcode.id,
        externalId: brcode.externalId,
        userId: userId,
        amount: value,
        description: description,
        status: 'pending',
        qrCode: brcode.uuid,
        pixKey: brcode.uuid,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hora
        createdAt: new Date(),
        type: 'pix_deposit',
      };

      // Placeholder para persistência
      this.saveTransaction(transactionData);

      logger.info('PIX QR Code generated successfully', {
        id: brcode.id,
        externalId: brcode.externalId,
        amount: value,
      });

      return {
        success: true,
        data: {
          id: brcode.id,
          externalId: brcode.externalId,
          qrCode: brcode.uuid,
          qrCodeImage: `data:image/png;base64,${brcode.qrCodePng}`,
          pixKey: brcode.uuid,
          amount: value,
          description: description,
          expiresAt: transactionData.expiresAt,
          status: 'pending',
        },
      };
    } catch (error) {
      logger.error('Error generating PIX QR Code', {
        error: error.message,
        value,
        userId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Processa pagamento de boleto
   * @param {string} barcode - Código de barras do boleto
   * @param {number} amount - Valor em centavos
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} Resultado do pagamento
   */
  async payBill(barcode, amount, userId) {
    try {
      logger.info('Processing bill payment', { barcode, amount, userId });

      // Criar pagamento de boleto
      const payment = new starkbank.BoletoPayment({
        line: barcode,
        taxId: '012.345.678-90', // CPF/CNPJ da empresa
        description: `Pagamento de boleto via Capy Pay - User: ${userId}`,
        amount: amount,
        tags: [
          `user:${userId}`,
          'capy-pay',
          'bill-payment',
        ],
      });

      const payments = await starkbank.boletoPayment.create([payment]);
      const createdPayment = payments[0];

      // TODO: Salvar no banco de dados
      const transactionData = {
        id: createdPayment.id,
        userId: userId,
        amount: amount,
        barcode: barcode,
        description: createdPayment.description,
        status: createdPayment.status,
        fee: createdPayment.fee,
        createdAt: new Date(),
        type: 'bill_payment',
        starkbankId: createdPayment.id,
      };

      this.saveTransaction(transactionData);

      logger.info('Bill payment processed successfully', {
        id: createdPayment.id,
        amount: amount,
        status: createdPayment.status,
      });

      return {
        success: true,
        data: {
          id: createdPayment.id,
          amount: amount,
          fee: createdPayment.fee,
          status: createdPayment.status,
          description: createdPayment.description,
          scheduledDate: createdPayment.scheduled,
          createdAt: transactionData.createdAt,
        },
      };
    } catch (error) {
      logger.error('Error processing bill payment', {
        error: error.message,
        barcode,
        amount,
        userId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Configura webhook do StarkBank
   * @param {string} url - URL do webhook
   * @returns {Promise<Object>} Configuração do webhook
   */
  async setupWebhook(url) {
    try {
      logger.info('Setting up StarkBank webhook', { url });

      const webhook = new starkbank.Webhook({
        url: url,
        subscriptions: [
          'boleto-payment',
          'dynamic-brcode',
          'deposit',
          'transfer',
        ],
      });

      const webhooks = await starkbank.webhook.create([webhook]);
      const createdWebhook = webhooks[0];

      logger.info('Webhook configured successfully', {
        id: createdWebhook.id,
        url: createdWebhook.url,
      });

      return {
        success: true,
        data: {
          id: createdWebhook.id,
          url: createdWebhook.url,
          subscriptions: createdWebhook.subscriptions,
        },
      };
    } catch (error) {
      logger.error('Error setting up webhook', {
        error: error.message,
        url,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Processa eventos do webhook
   * @param {Object} eventData - Dados do evento recebido
   * @returns {Promise<Object>} Resultado do processamento
   */
  async handleWebhookEvent(eventData) {
    try {
      logger.info('Processing webhook event', {
        subscription: eventData.subscription,
        id: eventData.id,
      });

      const { subscription, log } = eventData;

      switch (subscription) {
        case 'dynamic-brcode':
          return await this.handlePixEvent(log);
        
        case 'boleto-payment':
          return await this.handleBillPaymentEvent(log);
        
        case 'deposit':
          return await this.handleDepositEvent(log);
        
        default:
          logger.warn('Unhandled webhook event', { subscription });
          return { success: true, message: 'Event ignored' };
      }
    } catch (error) {
      logger.error('Error processing webhook event', {
        error: error.message,
        eventData,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Processa eventos PIX
   * @private
   */
  async handlePixEvent(log) {
    const { type, brcode } = log;

    logger.info('Processing PIX event', { type, brcodeId: brcode?.id });

    if (type === 'credited') {
      // PIX foi recebido
      const transactionId = brcode.externalId;
      
      // TODO: Atualizar no banco de dados
      await this.updateTransaction(transactionId, {
        status: 'completed',
        completedAt: new Date(),
        actualAmount: brcode.amount,
      });

      logger.info('PIX payment received', {
        transactionId,
        amount: brcode.amount,
      });

      // TODO: Notificar frontend via WebSocket ou similar
      await this.notifyTransactionUpdate(transactionId, 'completed');
    }

    return { success: true };
  }

  /**
   * Processa eventos de pagamento de boleto
   * @private
   */
  async handleBillPaymentEvent(log) {
    const { type, payment } = log;

    logger.info('Processing bill payment event', { type, paymentId: payment?.id });

    // TODO: Atualizar status no banco de dados
    await this.updateTransaction(payment.id, {
      status: payment.status,
      updatedAt: new Date(),
    });

    logger.info('Bill payment status updated', {
      paymentId: payment.id,
      status: payment.status,
    });

    return { success: true };
  }

  /**
   * Processa eventos de depósito
   * @private
   */
  async handleDepositEvent(log) {
    const { type, deposit } = log;

    logger.info('Processing deposit event', { type, depositId: deposit?.id });

    // TODO: Processar depósito recebido
    
    return { success: true };
  }

  /**
   * Placeholder para salvar transação no banco
   * @private
   */
  saveTransaction(transactionData) {
    // TODO: Implementar persistência real
    logger.info('Saving transaction (placeholder)', {
      id: transactionData.id,
      type: transactionData.type,
      amount: transactionData.amount,
    });
    
    // Em memória temporariamente
    if (!global.transactions) {
      global.transactions = new Map();
    }
    global.transactions.set(transactionData.id, transactionData);
  }

  /**
   * Placeholder para atualizar transação no banco
   * @private
   */
  async updateTransaction(transactionId, updates) {
    // TODO: Implementar atualização real
    logger.info('Updating transaction (placeholder)', {
      transactionId,
      updates,
    });

    if (global.transactions && global.transactions.has(transactionId)) {
      const existing = global.transactions.get(transactionId);
      global.transactions.set(transactionId, { ...existing, ...updates });
    }
  }

  /**
   * Placeholder para notificar atualização de transação
   * @private
   */
  async notifyTransactionUpdate(transactionId, status) {
    // TODO: Implementar notificação real (WebSocket, push notification, etc.)
    logger.info('Notifying transaction update (placeholder)', {
      transactionId,
      status,
    });
  }

  /**
   * Obtém transação por ID
   * @param {string} transactionId - ID da transação
   * @returns {Object|null} Dados da transação
   */
  getTransaction(transactionId) {
    // TODO: Implementar busca real no banco
    if (global.transactions && global.transactions.has(transactionId)) {
      return global.transactions.get(transactionId);
    }
    return null;
  }

  /**
   * Lista transações por usuário
   * @param {string} userId - ID do usuário
   * @returns {Array} Lista de transações
   */
  getUserTransactions(userId) {
    // TODO: Implementar busca real no banco
    if (!global.transactions) {
      return [];
    }

    return Array.from(global.transactions.values())
      .filter(tx => tx.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

module.exports = StarkBankService; 