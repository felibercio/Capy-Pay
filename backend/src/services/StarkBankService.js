const starkbank = require('starkbank');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const CapyCoinMintService = require('./CapyCoinMintService');
const SupabaseService = require('./SupabaseService');

class StarkBankService {
  constructor() {
    this.isConfigured = false;
    this.initializeStarkBank();
    this.supa = new SupabaseService();
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
        logger.warn('StarkBank credentials not configured. Payments routes will be disabled.', {
          hasProjectId: !!projectId,
          hasPrivateKeyPath: !!privateKeyPath,
        });
        this.isConfigured = false;
        return; // Não bloquear inicialização do servidor
      }

      // Ler chave privada
      let privateKeyContent;
      try {
        privateKeyContent = fs.readFileSync(path.resolve(privateKeyPath), 'utf8');
      } catch (err) {
        logger.warn('StarkBank private key file not found or unreadable. Payments routes will be disabled.', {
          path: privateKeyPath,
          error: err.message,
        });
        this.isConfigured = false;
        return;
      }

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
      this.isConfigured = true;
    } catch (error) {
      logger.error('Failed to initialize StarkBank', { error: error.message });
      // Não lançar erro para não impedir a inicialização do servidor em ambientes de desenvolvimento
      this.isConfigured = false;
    }
  }

  /**
   * Gera um QR Code PIX dinâmico para recebimento
   * @param {number} value - Valor em centavos (R$ 10.00 = 1000)
   * @param {string} description - Descrição do pagamento
   * @param {string} userId - ID do usuário no sistema
   * @returns {Promise<Object>} Dados do PIX gerado
   */
  async generatePixQrCode(value, description, userId, userAddress) {
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
        userAddress: userAddress,
        amount: value,
        description: description,
        status: 'pending',
        qrCode: brcode.uuid,
        pixKey: brcode.uuid,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hora
        createdAt: new Date(),
        type: 'pix_deposit',
      };

      // Persistir transação
      await this.saveTransaction(transactionData);

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
          userAddress: userAddress,
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

      // Fallback dev: gerar QR Code PIX simulado quando houver erro
      // Útil em ambientes locais sem credenciais StarkBank
      const devFallback = process.env.NODE_ENV === 'development' || process.env.MOCK_PIX === 'true';
      if (devFallback) {
        try {
          const mockId = `dev_pix_${uuidv4()}`;
          const externalId = `capy-${userId}-${uuidv4()}`;
          const qrUuid = uuidv4();
          const expiresAt = new Date(Date.now() + 3600 * 1000);

          // Não gerar imagem PNG inválida; deixar o frontend renderizar via SVG
          // Usamos um conteúdo determinístico para o QR: externalId + amount
          const qrContent = `PIX|ext:${externalId}|amt:${value}`;

          const transactionData = {
            id: mockId,
            externalId,
            userId: userId,
            userAddress: userAddress,
            amount: value,
            description: description,
            status: 'pending',
            // Para ambientes dev, usamos qrContent como dado para o QR
            qrCode: qrContent,
            pixKey: qrUuid,
            expiresAt,
            createdAt: new Date(),
            type: 'pix_deposit',
          };

          await this.saveTransaction(transactionData);

          logger.warn('Using dev fallback for PIX QR Code generation', {
            id: mockId,
            externalId,
            amount: value,
          });

          return {
            success: true,
            data: {
              id: mockId,
              externalId,
              // Entregar apenas o dado do QR e deixar o front gerar a imagem
              qrCode: qrContent,
              qrCodeImage: null,
              pixKey: qrUuid,
              amount: value,
              description: description,
              userAddress: userAddress,
              expiresAt,
              status: 'pending',
            },
          };
        } catch (fallbackErr) {
          logger.error('Dev fallback for PIX QR generation failed', { error: fallbackErr.message });
        }
      }

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
      // Usar o ID do brcode como transactionId (mantemos id = brcode.id na criação)
      const transactionId = brcode.id;
      
      // Atualizar status da transação
      await this.updateTransaction(transactionId, {
        status: 'completed',
        completedAt: new Date(),
        actualAmount: brcode.amount,
      });

      logger.info('PIX payment received', {
        transactionId,
        amount: brcode.amount,
      });

      // Inserir depósito confirmado
      try {
        const tx = await this.getTransaction(transactionId);
        if (tx && tx.user_id) {
          await this.supa.insertDeposit({
            transaction_id: transactionId,
            user_id: tx.user_id,
            method: 'pix',
            amount: brcode.amount,
            currency: 'BRL',
            status: 'confirmed',
            credited_at: new Date(),
            description: 'PIX credit confirmed',
            metadata: { brcode_id: brcode.id, external_id: brcode.externalId || null }
          });

          logger.info('Deposit recorded for PIX credit', {
            transactionId,
            userId: tx.user_id,
            amount: brcode.amount,
          });
        } else {
          logger.warn('Transaction not found to record deposit', { transactionId });
        }
      } catch (depErr) {
        logger.error('Error inserting deposit record', { error: depErr.message, transactionId });
      }

      // Mintar CAPY com base no valor em BRL, se possível
      try {
        const tx = await this.getTransaction(transactionId);
        const userAddress = tx?.userAddress;
        const capyPerBrl = process.env.CAPY_PER_BRL ? Number(process.env.CAPY_PER_BRL) : null;

        if (userAddress && capyPerBrl && !Number.isNaN(capyPerBrl)) {
          const amountBRL = Number(brcode.amount) / 100; // converter centavos para reais
          const capyAmount = amountBRL * capyPerBrl;

          const mintService = new CapyCoinMintService();
          const mintResult = await mintService.mintToUser(userAddress, capyAmount);

          if (mintResult.success) {
            await this.updateTransaction(transactionId, {
              capyMint: {
                capyAmount,
                txHash: mintResult.txHash,
                mintedAt: new Date(),
              },
            });

            // Registrar mint no Supabase
            await this.supa.insertCapyMint({
              transaction_id: transactionId,
              user_address: userAddress,
              capy_amount: capyAmount,
              tx_hash: mintResult.txHash,
              minted_at: new Date(),
            });

            logger.info('CAPY minted for PIX deposit', {
              transactionId,
              userAddress,
              capyAmount,
              txHash: mintResult.txHash,
            });
          } else {
            await this.updateTransaction(transactionId, {
              capyMint: { error: mintResult.error, attemptedAt: new Date() },
            });

            logger.warn('CAPY mint failed', {
              transactionId,
              error: mintResult.error,
            });
          }
        } else {
          logger.warn('Skipping CAPY mint: missing userAddress or CAPY_PER_BRL', {
            transactionId,
            hasAddress: !!userAddress,
            capyPerBrl,
          });
        }
      } catch (mintError) {
        logger.error('Error during CAPY mint integration', { error: mintError.message });
      }

      // Registrar depósito PIX onchain (evento), se configurado
      try {
        const DepositRegistryService = require('./DepositRegistryService');
        const registry = new DepositRegistryService();
        if (registry.isConfigured) {
          const amountInCents = Number(brcode.amount);
          const externalId = brcode.externalId || '';
          const userAddress = (await this.getTransaction(transactionId))?.userAddress;

          if (userAddress && amountInCents > 0) {
            const regResult = await registry.recordPixDeposit(
              String(brcode.id),
              userAddress,
              amountInCents,
              externalId
            );

            if (regResult.success) {
              await this.updateTransaction(transactionId, {
                onchainRegistry: {
                  txHash: regResult.txHash,
                  recordedAt: new Date(),
                },
              });

              logger.info('Onchain PIX deposit recorded', {
                transactionId,
                txHash: regResult.txHash,
              });
            } else {
              logger.warn('Onchain PIX deposit registry failed', { error: regResult.error });
            }
          } else {
            logger.warn('Skipping onchain registry: missing userAddress or amount');
          }
        } else {
          logger.warn('DepositRegistryService not configured, skipping onchain registry');
        }
      } catch (registryError) {
        logger.error('Error while recording PIX deposit onchain', { error: registryError.message });
      }

      // Notificar frontend via WebSocket ou similar
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
    try {
      const payload = {
        id: transactionData.id,
        external_id: transactionData.externalId || null,
        user_id: transactionData.userId,
        user_address: transactionData.userAddress || null,
        type: transactionData.type,
        amount: transactionData.amount,
        description: transactionData.description || null,
        status: transactionData.status,
        qr_code: transactionData.qrCode || null,
        pix_key: transactionData.pixKey || null,
        expires_at: transactionData.expiresAt || null,
        created_at: transactionData.createdAt || new Date(),
        metadata: transactionData.metadata || null,
      };

      // In development or when Supabase admin is not configured, avoid throwing and
      // simply return the payload so the flow continues for local testing.
      const supa = this.supa;
      const canPersist = supa && supa.isConfigured && supa.hasAdmin;
      if (!canPersist) {
        logger.warn('Supabase not configured or missing service role; skipping transaction persistence in dev', {
          isConfigured: !!(supa && supa.isConfigured),
          hasAdmin: !!(supa && supa.hasAdmin),
        });
        return payload; // non-blocking in local environments
      }

      return this.supa.insertTransaction(payload);
    } catch (error) {
      logger.error('Failed to save transaction', { error: error.message });
      // In dev, do not block the flow
      return null;
    }
  }

  /**
   * Placeholder para atualizar transação no banco
   * @private
   */
  async updateTransaction(transactionId, updates) {
    try {
      const mapped = {
        status: updates.status,
        completed_at: updates.completedAt,
        actual_amount: updates.actualAmount,
        updated_at: new Date(),
        metadata: updates.metadata || null,
      };
      return await this.supa.updateTransaction(transactionId, mapped);
    } catch (error) {
      logger.error('Failed to update transaction', { error: error.message });
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
  async getTransaction(transactionId) {
    try {
      return await this.supa.getTransaction(transactionId);
    } catch (error) {
      logger.error('Failed to get transaction', { error: error.message });
      return null;
    }
  }

  /**
   * Lista transações por usuário
   * @param {string} userId - ID do usuário
   * @returns {Array} Lista de transações
   */
  async getUserTransactions(userId) {
    try {
      return await this.supa.listTransactionsByUser(userId);
    } catch (error) {
      logger.error('Failed to list transactions', { error: error.message });
      return [];
    }
  }

  async getCapyMintsByTransaction(transactionId) {
    try {
      return await this.supa.listCapyMintsByTransaction(transactionId);
    } catch (error) {
      logger.error('Failed to list CAPY mints', { error: error.message });
      return [];
    }
  }
}

module.exports = StarkBankService;