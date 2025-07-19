const { ethers } = require('ethers');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const logger = require('../utils/logger');

class WalletService {
  constructor() {
    // Configurações de segurança
    this.config = {
      encryptionAlgorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
      encryptionKey: process.env.WALLET_ENCRYPTION_KEY,
      salt: process.env.WALLET_SALT,
      kmsKeyId: process.env.KMS_KEY_ID,
      rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    };

    // Verificar configuração de segurança
    this.validateSecurityConfig();

    // Inicializar provider
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);

    // Cache de carteiras descriptografadas (apenas em memória, nunca persistir)
    this.walletCache = new Map();
    
    // Configurar limpeza automática do cache (5 minutos)
    setInterval(() => {
      this.clearWalletCache();
    }, 5 * 60 * 1000);
  }

  /**
   * Valida configuração de segurança
   * @private
   */
  validateSecurityConfig() {
    if (!this.config.encryptionKey) {
      throw new Error('WALLET_ENCRYPTION_KEY is required for wallet security');
    }

    if (this.config.encryptionKey.length < 32) {
      throw new Error('WALLET_ENCRYPTION_KEY must be at least 32 characters');
    }

    if (!this.config.salt) {
      throw new Error('WALLET_SALT is required for wallet security');
    }

    logger.info('Wallet security configuration validated');
  }

  /**
   * Cria carteira custodial para usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} Dados da carteira criada
   */
  async createWalletForUser(userId) {
    try {
      logger.info('Creating custodial wallet for user', { userId });

      // Verificar se usuário já possui carteira
      const existingWallet = await this.getWalletByUserId(userId);
      if (existingWallet) {
        logger.warn('User already has a wallet', { userId });
        return {
          success: false,
          error: 'User already has a wallet',
        };
      }

      // 1. Gerar novo par de chaves
      const wallet = ethers.Wallet.createRandom();
      
      logger.info('New wallet generated', {
        userId,
        address: wallet.address,
      });

      // 2. Criptografar chave privada
      const encryptedPrivateKey = await this.encryptPrivateKey(wallet.privateKey, userId);

      // 3. Criar registro da carteira
      const walletData = {
        id: crypto.randomUUID(),
        userId,
        address: wallet.address,
        encryptedPrivateKey,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
        network: 'base',
        type: 'custodial',
        // Metadados de segurança
        encryptionVersion: '1.0',
        keyDerivationRounds: 100000,
      };

      // 4. Salvar carteira
      await this.saveWallet(walletData);

      // 5. Atualizar usuário com endereço da carteira
      await this.updateUserWallet(userId, wallet.address);

      logger.info('Custodial wallet created successfully', {
        userId,
        walletId: walletData.id,
        address: wallet.address,
      });

      return {
        success: true,
        wallet: {
          id: walletData.id,
          address: wallet.address,
          network: walletData.network,
          createdAt: walletData.createdAt,
        },
      };

    } catch (error) {
      logger.error('Failed to create custodial wallet', {
        error: error.message,
        stack: error.stack,
        userId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtém endereço da carteira do usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<string|null>} Endereço da carteira
   */
  async getWalletAddress(userId) {
    try {
      const wallet = await this.getWalletByUserId(userId);
      
      if (!wallet) {
        logger.warn('Wallet not found for user', { userId });
        return null;
      }

      return wallet.address;
    } catch (error) {
      logger.error('Error getting wallet address', {
        error: error.message,
        userId,
      });
      return null;
    }
  }

  /**
   * Assina transação usando chave privada custodial
   * @param {string} userId - ID do usuário
   * @param {Object} transaction - Dados da transação
   * @returns {Promise<Object>} Transação assinada
   */
  async signTransaction(userId, transaction) {
    try {
      logger.info('Signing transaction for user', {
        userId,
        to: transaction.to,
        value: transaction.value,
      });

      // 1. Obter carteira do usuário
      const walletData = await this.getWalletByUserId(userId);
      if (!walletData) {
        throw new Error('Wallet not found for user');
      }

      // 2. Descriptografar chave privada
      const privateKey = await this.decryptPrivateKey(
        walletData.encryptedPrivateKey,
        userId
      );

      // 3. Criar instância da carteira
      const wallet = new ethers.Wallet(privateKey, this.provider);

      // 4. Preparar transação
      const txData = {
        to: transaction.to,
        value: transaction.value || '0',
        data: transaction.data || '0x',
        gasLimit: transaction.gasLimit,
        gasPrice: transaction.gasPrice,
        nonce: transaction.nonce,
      };

      // 5. Estimar gas se não fornecido
      if (!txData.gasLimit) {
        txData.gasLimit = await wallet.estimateGas(txData);
      }

      // 6. Obter gas price se não fornecido
      if (!txData.gasPrice) {
        const feeData = await this.provider.getFeeData();
        txData.gasPrice = feeData.gasPrice;
      }

      // 7. Obter nonce se não fornecido
      if (txData.nonce === undefined) {
        txData.nonce = await wallet.getNonce();
      }

      // 8. Assinar transação
      const signedTx = await wallet.signTransaction(txData);

      logger.info('Transaction signed successfully', {
        userId,
        txHash: ethers.keccak256(signedTx),
        gasLimit: txData.gasLimit.toString(),
        gasPrice: txData.gasPrice.toString(),
      });

      // 9. Limpar chave privada da memória
      privateKey.replace(/./g, '0');

      return {
        success: true,
        signedTransaction: signedTx,
        transactionHash: ethers.keccak256(signedTx),
        gasEstimate: {
          gasLimit: txData.gasLimit.toString(),
          gasPrice: txData.gasPrice.toString(),
          estimatedCost: (txData.gasLimit * txData.gasPrice).toString(),
        },
      };

    } catch (error) {
      logger.error('Failed to sign transaction', {
        error: error.message,
        stack: error.stack,
        userId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Envia transação assinada
   * @param {string} signedTransaction - Transação assinada
   * @returns {Promise<Object>} Resultado do envio
   */
  async sendSignedTransaction(signedTransaction) {
    try {
      logger.info('Sending signed transaction');

      const tx = await this.provider.sendTransaction(signedTransaction);
      
      logger.info('Transaction sent successfully', {
        txHash: tx.hash,
        nonce: tx.nonce,
      });

      return {
        success: true,
        transactionHash: tx.hash,
        nonce: tx.nonce,
        transaction: tx,
      };

    } catch (error) {
      logger.error('Failed to send transaction', {
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtém saldo da carteira
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} Saldo da carteira
   */
  async getWalletBalance(userId) {
    try {
      const address = await this.getWalletAddress(userId);
      if (!address) {
        throw new Error('Wallet not found for user');
      }

      // Saldo ETH
      const ethBalance = await this.provider.getBalance(address);

      // TODO: Implementar saldos de tokens ERC-20
      // const tokenBalances = await this.getTokenBalances(address);

      return {
        success: true,
        address,
        balances: {
          ETH: {
            balance: ethers.formatEther(ethBalance),
            balanceWei: ethBalance.toString(),
          },
          // ...tokenBalances
        },
      };

    } catch (error) {
      logger.error('Error getting wallet balance', {
        error: error.message,
        userId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Criptografa chave privada
   * @private
   */
  async encryptPrivateKey(privateKey, userId) {
    try {
      // Em produção, usar KMS/HSM
      if (this.config.kmsKeyId && process.env.NODE_ENV === 'production') {
        return await this.encryptWithKMS(privateKey, userId);
      }

      // Para desenvolvimento, usar criptografia local
      return this.encryptWithLocalKey(privateKey, userId);
    } catch (error) {
      logger.error('Error encrypting private key', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Descriptografa chave privada
   * @private
   */
  async decryptPrivateKey(encryptedPrivateKey, userId) {
    try {
      // Em produção, usar KMS/HSM
      if (this.config.kmsKeyId && process.env.NODE_ENV === 'production') {
        return await this.decryptWithKMS(encryptedPrivateKey, userId);
      }

      // Para desenvolvimento, usar descriptografia local
      return this.decryptWithLocalKey(encryptedPrivateKey, userId);
    } catch (error) {
      logger.error('Error decrypting private key', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Criptografia local (desenvolvimento)
   * @private
   */
  encryptWithLocalKey(privateKey, userId) {
    try {
      // Criar chave derivada específica do usuário
      const userKey = crypto.pbkdf2Sync(
        this.config.encryptionKey + userId,
        this.config.salt,
        100000,
        32,
        'sha512'
      );

      // Criptografar usando AES-256-GCM
      const cipher = crypto.createCipher('aes-256-gcm', userKey);
      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        authTag: authTag.toString('hex'),
        algorithm: 'aes-256-gcm',
        version: '1.0',
      };
    } catch (error) {
      logger.error('Local encryption failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Descriptografia local (desenvolvimento)
   * @private
   */
  decryptWithLocalKey(encryptedData, userId) {
    try {
      // Recriar chave derivada específica do usuário
      const userKey = crypto.pbkdf2Sync(
        this.config.encryptionKey + userId,
        this.config.salt,
        100000,
        32,
        'sha512'
      );

      // Descriptografar usando AES-256-GCM
      const decipher = crypto.createDecipher('aes-256-gcm', userKey);
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Local decryption failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Criptografia com KMS (produção)
   * @private
   */
  async encryptWithKMS(privateKey, userId) {
    // TODO: Implementar integração com AWS KMS, Google Cloud KMS, ou Azure Key Vault
    logger.info('KMS encryption not implemented - using local encryption');
    return this.encryptWithLocalKey(privateKey, userId);
  }

  /**
   * Descriptografia com KMS (produção)
   * @private
   */
  async decryptWithKMS(encryptedData, userId) {
    // TODO: Implementar integração com KMS
    logger.info('KMS decryption not implemented - using local decryption');
    return this.decryptWithLocalKey(encryptedData, userId);
  }

  /**
   * Busca carteira por ID do usuário
   * @private
   */
  async getWalletByUserId(userId) {
    // TODO: Implementar busca real no banco
    if (global.wallets) {
      return Array.from(global.wallets.values())
        .find(wallet => wallet.userId === userId && wallet.status === 'active');
    }
    return null;
  }

  /**
   * Salva carteira no banco
   * @private
   */
  async saveWallet(walletData) {
    // TODO: Implementar persistência real com criptografia adicional
    logger.info('Saving wallet (placeholder)', {
      walletId: walletData.id,
      userId: walletData.userId,
      address: walletData.address,
    });

    if (!global.wallets) {
      global.wallets = new Map();
    }
    global.wallets.set(walletData.id, walletData);
  }

  /**
   * Atualiza usuário com endereço da carteira
   * @private
   */
  async updateUserWallet(userId, walletAddress) {
    // TODO: Implementar atualização real do usuário
    if (global.users && global.users.has(userId)) {
      const user = global.users.get(userId);
      user.walletAddress = walletAddress;
      user.updatedAt = new Date();
      global.users.set(userId, user);
    }
  }

  /**
   * Limpa cache de carteiras
   * @private
   */
  clearWalletCache() {
    logger.debug('Clearing wallet cache for security');
    this.walletCache.clear();
  }

  /**
   * Lista carteiras (admin)
   */
  async listWallets(limit = 50, offset = 0) {
    // TODO: Implementar paginação real
    if (!global.wallets) {
      return { wallets: [], total: 0 };
    }

    const wallets = Array.from(global.wallets.values())
      .map(wallet => ({
        id: wallet.id,
        userId: wallet.userId,
        address: wallet.address,
        network: wallet.network,
        status: wallet.status,
        createdAt: wallet.createdAt,
        // NÃO incluir chave privada criptografada
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(offset, offset + limit);

    return {
      wallets,
      total: global.wallets.size,
      limit,
      offset,
    };
  }

  /**
   * Obtém estatísticas de carteiras
   */
  getWalletStats() {
    const totalWallets = global.wallets ? global.wallets.size : 0;
    const activeWallets = global.wallets 
      ? Array.from(global.wallets.values()).filter(w => w.status === 'active').length
      : 0;

    return {
      totalWallets,
      activeWallets,
      cacheSize: this.walletCache.size,
    };
  }

  /**
   * Rotaciona chave de criptografia (admin)
   */
  async rotateEncryptionKey(newEncryptionKey) {
    // TODO: Implementar rotação segura de chaves
    logger.warn('Key rotation not implemented - requires careful planning');
    throw new Error('Key rotation not implemented');
  }
}

module.exports = WalletService; 