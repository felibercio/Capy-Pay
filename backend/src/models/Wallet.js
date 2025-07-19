/**
 * Modelo de dados para carteiras custodiais
 * Define a estrutura e validações para carteiras de usuários
 */

const crypto = require('crypto');
const { ethers } = require('ethers');
const logger = require('../utils/logger');

class Wallet {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.userId = data.userId;
    this.address = data.address;
    this.encryptedPrivateKey = data.encryptedPrivateKey;
    
    // Configurações da carteira
    this.network = data.network || 'base';
    this.type = data.type || 'custodial'; // custodial, non-custodial
    this.status = data.status || 'active'; // active, suspended, deleted
    
    // Metadados de segurança
    this.encryptionVersion = data.encryptionVersion || '1.0';
    this.keyDerivationRounds = data.keyDerivationRounds || 100000;
    this.lastUsed = data.lastUsed || null;
    this.transactionCount = data.transactionCount || 0;
    
    // Timestamps
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    
    // Validar dados obrigatórios
    this.validate();
  }

  /**
   * Valida dados da carteira
   */
  validate() {
    if (!this.userId) {
      throw new Error('User ID is required');
    }

    if (!this.address) {
      throw new Error('Wallet address is required');
    }

    if (!this.isValidAddress(this.address)) {
      throw new Error('Invalid wallet address format');
    }

    if (!this.encryptedPrivateKey) {
      throw new Error('Encrypted private key is required');
    }

    if (!this.isValidNetwork(this.network)) {
      throw new Error('Invalid network');
    }
  }

  /**
   * Valida endereço Ethereum
   */
  isValidAddress(address) {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Valida rede suportada
   */
  isValidNetwork(network) {
    const supportedNetworks = ['base', 'ethereum', 'polygon'];
    return supportedNetworks.includes(network.toLowerCase());
  }

  /**
   * Converte para objeto simples (sem métodos)
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      address: this.address,
      network: this.network,
      type: this.type,
      status: this.status,
      encryptionVersion: this.encryptionVersion,
      lastUsed: this.lastUsed,
      transactionCount: this.transactionCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // NÃO incluir encryptedPrivateKey por segurança
    };
  }

  /**
   * Versão sanitizada para envio ao frontend
   */
  toSafeJSON() {
    return {
      id: this.id,
      address: this.address,
      network: this.network,
      status: this.status,
      lastUsed: this.lastUsed,
      transactionCount: this.transactionCount,
      createdAt: this.createdAt,
    };
  }

  /**
   * Atualiza dados da carteira
   */
  update(updates) {
    const allowedUpdates = [
      'status', 'lastUsed', 'transactionCount'
    ];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        this[key] = value;
      }
    }

    this.updatedAt = new Date();
  }

  /**
   * Marca carteira como usada
   */
  markAsUsed() {
    this.lastUsed = new Date();
    this.transactionCount += 1;
    this.updatedAt = new Date();
  }

  /**
   * Verifica se carteira está ativa
   */
  isActive() {
    return this.status === 'active';
  }

  /**
   * Suspende carteira
   */
  suspend(reason) {
    this.status = 'suspended';
    this.suspendedReason = reason;
    this.suspendedAt = new Date();
    this.updatedAt = new Date();
    
    logger.warn('Wallet suspended', {
      walletId: this.id,
      userId: this.userId,
      reason,
    });
  }

  /**
   * Reativa carteira
   */
  reactivate() {
    this.status = 'active';
    this.suspendedReason = null;
    this.suspendedAt = null;
    this.updatedAt = new Date();
    
    logger.info('Wallet reactivated', {
      walletId: this.id,
      userId: this.userId,
    });
  }

  /**
   * Obtém configuração de rede
   */
  getNetworkConfig() {
    const networkConfigs = {
      base: {
        chainId: 8453,
        name: 'Base',
        rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
        blockExplorer: 'https://basescan.org',
        nativeCurrency: {
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
        },
      },
      ethereum: {
        chainId: 1,
        name: 'Ethereum',
        rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/',
        blockExplorer: 'https://etherscan.io',
        nativeCurrency: {
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
        },
      },
    };

    return networkConfigs[this.network] || networkConfigs.base;
  }

  /**
   * Gera checksum do endereço
   */
  getChecksumAddress() {
    return ethers.getAddress(this.address);
  }
}

/**
 * Schema para banco de dados (PostgreSQL)
 */
const WalletSchema = {
  tableName: 'wallets',
  columns: {
    id: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()',
    user_id: 'UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE',
    address: 'VARCHAR(42) UNIQUE NOT NULL',
    encrypted_private_key: 'TEXT NOT NULL', // JSON com dados criptografados
    network: "VARCHAR(20) DEFAULT 'base' CHECK (network IN ('base', 'ethereum', 'polygon'))",
    type: "VARCHAR(20) DEFAULT 'custodial' CHECK (type IN ('custodial', 'non-custodial'))",
    status: "VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'))",
    encryption_version: 'VARCHAR(10) DEFAULT \'1.0\'',
    key_derivation_rounds: 'INTEGER DEFAULT 100000',
    last_used: 'TIMESTAMP',
    transaction_count: 'INTEGER DEFAULT 0',
    suspended_reason: 'TEXT',
    suspended_at: 'TIMESTAMP',
    created_at: 'TIMESTAMP DEFAULT NOW()',
    updated_at: 'TIMESTAMP DEFAULT NOW()',
  },
  indexes: [
    'CREATE UNIQUE INDEX idx_wallets_user_id ON wallets(user_id)',
    'CREATE UNIQUE INDEX idx_wallets_address ON wallets(address)',
    'CREATE INDEX idx_wallets_network ON wallets(network)',
    'CREATE INDEX idx_wallets_status ON wallets(status)',
    'CREATE INDEX idx_wallets_created_at ON wallets(created_at)',
  ],
  constraints: [
    'ALTER TABLE wallets ADD CONSTRAINT chk_address_format CHECK (address ~ \'^0x[a-fA-F0-9]{40}$\')',
  ],
};

/**
 * Schema para MongoDB (alternativo)
 */
const WalletMongoSchema = {
  collection: 'wallets',
  schema: {
    _id: 'ObjectId',
    userId: { type: 'String', required: true, unique: true },
    address: { type: 'String', required: true, unique: true },
    encryptedPrivateKey: { type: 'Mixed', required: true },
    network: { 
      type: 'String', 
      enum: ['base', 'ethereum', 'polygon'], 
      default: 'base' 
    },
    type: { 
      type: 'String', 
      enum: ['custodial', 'non-custodial'], 
      default: 'custodial' 
    },
    status: { 
      type: 'String', 
      enum: ['active', 'suspended', 'deleted'], 
      default: 'active' 
    },
    encryptionVersion: { type: 'String', default: '1.0' },
    keyDerivationRounds: { type: 'Number', default: 100000 },
    lastUsed: 'Date',
    transactionCount: { type: 'Number', default: 0 },
    suspendedReason: 'String',
    suspendedAt: 'Date',
    createdAt: { type: 'Date', default: Date.now },
    updatedAt: { type: 'Date', default: Date.now },
  },
  indexes: [
    { userId: 1 },
    { address: 1 },
    { network: 1 },
    { status: 1 },
    { createdAt: -1 },
  ],
};

/**
 * Modelo para transações de carteira
 */
class WalletTransaction {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.walletId = data.walletId;
    this.userId = data.userId;
    this.transactionHash = data.transactionHash;
    this.type = data.type; // send, receive, swap, approve
    this.status = data.status || 'pending'; // pending, confirmed, failed
    this.from = data.from;
    this.to = data.to;
    this.value = data.value;
    this.gasUsed = data.gasUsed;
    this.gasPrice = data.gasPrice;
    this.blockNumber = data.blockNumber;
    this.confirmations = data.confirmations || 0;
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date();
    this.confirmedAt = data.confirmedAt || null;
  }

  toJSON() {
    return {
      id: this.id,
      walletId: this.walletId,
      userId: this.userId,
      transactionHash: this.transactionHash,
      type: this.type,
      status: this.status,
      from: this.from,
      to: this.to,
      value: this.value,
      gasUsed: this.gasUsed,
      gasPrice: this.gasPrice,
      blockNumber: this.blockNumber,
      confirmations: this.confirmations,
      metadata: this.metadata,
      createdAt: this.createdAt,
      confirmedAt: this.confirmedAt,
    };
  }
}

/**
 * Schema para transações de carteira
 */
const WalletTransactionSchema = {
  tableName: 'wallet_transactions',
  columns: {
    id: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()',
    wallet_id: 'UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE',
    user_id: 'UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE',
    transaction_hash: 'VARCHAR(66) UNIQUE NOT NULL',
    type: "VARCHAR(20) NOT NULL CHECK (type IN ('send', 'receive', 'swap', 'approve'))",
    status: "VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed'))",
    from_address: 'VARCHAR(42)',
    to_address: 'VARCHAR(42)',
    value: 'DECIMAL(36, 18)',
    gas_used: 'BIGINT',
    gas_price: 'BIGINT',
    block_number: 'BIGINT',
    confirmations: 'INTEGER DEFAULT 0',
    metadata: 'JSONB DEFAULT \'{}\'',
    created_at: 'TIMESTAMP DEFAULT NOW()',
    confirmed_at: 'TIMESTAMP',
  },
  indexes: [
    'CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id)',
    'CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions(user_id)',
    'CREATE INDEX idx_wallet_transactions_hash ON wallet_transactions(transaction_hash)',
    'CREATE INDEX idx_wallet_transactions_status ON wallet_transactions(status)',
    'CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at)',
  ],
};

module.exports = {
  Wallet,
  WalletSchema,
  WalletMongoSchema,
  WalletTransaction,
  WalletTransactionSchema,
}; 