/**
 * Modelo de dados para usuários
 * Define a estrutura e validações para dados de usuário
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

class User {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.googleId = data.googleId;
    this.email = data.email;
    this.name = data.name;
    this.picture = data.picture;
    this.emailVerified = data.emailVerified || false;
    
    // Dados da carteira
    this.walletAddress = data.walletAddress || null;
    
    // Status e configurações
    this.status = data.status || 'active'; // active, suspended, deleted
    this.kycStatus = data.kycStatus || 'pending'; // pending, approved, rejected
    
    // Preferências do usuário
    this.preferences = {
      notifications: true,
      language: 'pt-BR',
      currency: 'BRL',
      ...data.preferences,
    };
    
    // Contexto MiniKit/Farcaster
    this.miniKit = data.miniKit || null;
    this.farcaster = data.farcaster || null;
    
    // Metadados de segurança
    this.loginAttempts = data.loginAttempts || 0;
    this.lastLoginAttempt = data.lastLoginAttempt || null;
    this.lockedUntil = data.lockedUntil || null;
    
    // Timestamps
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.lastLogin = data.lastLogin || null;
    
    // Validar dados obrigatórios
    this.validate();
  }

  /**
   * Valida dados do usuário
   */
  validate() {
    if (!this.googleId) {
      throw new Error('Google ID is required');
    }

    if (!this.email) {
      throw new Error('Email is required');
    }

    if (!this.isValidEmail(this.email)) {
      throw new Error('Invalid email format');
    }

    if (!this.name || this.name.length < 1) {
      throw new Error('Name is required');
    }
  }

  /**
   * Valida formato do email
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Converte para objeto simples (sem métodos)
   */
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      picture: this.picture,
      emailVerified: this.emailVerified,
      walletAddress: this.walletAddress,
      status: this.status,
      kycStatus: this.kycStatus,
      preferences: this.preferences,
      miniKit: this.miniKit,
      farcaster: this.farcaster,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLogin: this.lastLogin,
    };
  }

  /**
   * Versão sanitizada para envio ao frontend
   */
  toSafeJSON() {
    const safe = this.toJSON();
    // Remover campos sensíveis se necessário
    return safe;
  }

  /**
   * Atualiza dados do usuário
   */
  update(updates) {
    const allowedUpdates = [
      'name', 'picture', 'preferences', 'miniKit', 
      'farcaster', 'walletAddress', 'kycStatus', 'lastLogin'
    ];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        if (key === 'preferences') {
          this.preferences = { ...this.preferences, ...value };
        } else {
          this[key] = value;
        }
      }
    }

    this.updatedAt = new Date();
    this.validate();
  }

  /**
   * Verifica se usuário está bloqueado
   */
  isLocked() {
    return this.lockedUntil && this.lockedUntil > new Date();
  }

  /**
   * Incrementa tentativas de login
   */
  incrementLoginAttempts() {
    this.loginAttempts += 1;
    this.lastLoginAttempt = new Date();
    
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const lockoutMinutes = parseInt(process.env.LOCKOUT_TIME_MINUTES) || 30;
    
    if (this.loginAttempts >= maxAttempts) {
      this.lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
      logger.warn('User account locked due to too many login attempts', {
        userId: this.id,
        email: this.email,
        attempts: this.loginAttempts,
        lockedUntil: this.lockedUntil,
      });
    }
    
    this.updatedAt = new Date();
  }

  /**
   * Reseta tentativas de login
   */
  resetLoginAttempts() {
    this.loginAttempts = 0;
    this.lastLoginAttempt = null;
    this.lockedUntil = null;
    this.lastLogin = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Associa contexto MiniKit
   */
  associateMiniKit(miniKitData) {
    this.miniKit = {
      worldId: miniKitData.worldId,
      appId: miniKitData.appId,
      verified: miniKitData.verified || false,
      connectedAt: new Date(),
    };
    
    if (miniKitData.farcaster) {
      this.farcaster = miniKitData.farcaster;
    }
    
    this.updatedAt = new Date();
  }

  /**
   * Verifica se usuário tem carteira
   */
  hasWallet() {
    return !!this.walletAddress;
  }

  /**
   * Verifica se usuário está verificado no MiniKit
   */
  isMiniKitVerified() {
    return this.miniKit && this.miniKit.verified;
  }

  /**
   * Verifica se KYC está aprovado
   */
  isKycApproved() {
    return this.kycStatus === 'approved';
  }

  /**
   * Obtém nível de permissões do usuário
   */
  getPermissionLevel() {
    if (!this.emailVerified) return 'unverified';
    if (!this.hasWallet()) return 'no_wallet';
    if (!this.isMiniKitVerified()) return 'unverified_minikit';
    if (!this.isKycApproved()) return 'pending_kyc';
    return 'full_access';
  }
}

/**
 * Schema para banco de dados (PostgreSQL)
 */
const UserSchema = {
  tableName: 'users',
  columns: {
    id: 'UUID PRIMARY KEY DEFAULT gen_random_uuid()',
    google_id: 'VARCHAR(255) UNIQUE NOT NULL',
    email: 'VARCHAR(255) UNIQUE NOT NULL',
    name: 'VARCHAR(255) NOT NULL',
    picture: 'TEXT',
    email_verified: 'BOOLEAN DEFAULT FALSE',
    wallet_address: 'VARCHAR(42)',
    status: "VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'))",
    kyc_status: "VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected'))",
    preferences: 'JSONB DEFAULT \'{}\'',
    minikit_data: 'JSONB',
    farcaster_data: 'JSONB',
    login_attempts: 'INTEGER DEFAULT 0',
    last_login_attempt: 'TIMESTAMP',
    locked_until: 'TIMESTAMP',
    created_at: 'TIMESTAMP DEFAULT NOW()',
    updated_at: 'TIMESTAMP DEFAULT NOW()',
    last_login: 'TIMESTAMP',
  },
  indexes: [
    'CREATE INDEX idx_users_email ON users(email)',
    'CREATE INDEX idx_users_google_id ON users(google_id)',
    'CREATE INDEX idx_users_wallet_address ON users(wallet_address)',
    'CREATE INDEX idx_users_status ON users(status)',
    'CREATE INDEX idx_users_created_at ON users(created_at)',
  ],
};

/**
 * Schema para MongoDB (alternativo)
 */
const UserMongoSchema = {
  collection: 'users',
  schema: {
    _id: 'ObjectId',
    googleId: { type: 'String', required: true, unique: true },
    email: { type: 'String', required: true, unique: true },
    name: { type: 'String', required: true },
    picture: 'String',
    emailVerified: { type: 'Boolean', default: false },
    walletAddress: 'String',
    status: { 
      type: 'String', 
      enum: ['active', 'suspended', 'deleted'], 
      default: 'active' 
    },
    kycStatus: { 
      type: 'String', 
      enum: ['pending', 'approved', 'rejected'], 
      default: 'pending' 
    },
    preferences: {
      notifications: { type: 'Boolean', default: true },
      language: { type: 'String', default: 'pt-BR' },
      currency: { type: 'String', default: 'BRL' },
    },
    miniKit: {
      worldId: 'String',
      appId: 'String',
      verified: { type: 'Boolean', default: false },
      connectedAt: 'Date',
    },
    farcaster: 'Mixed',
    loginAttempts: { type: 'Number', default: 0 },
    lastLoginAttempt: 'Date',
    lockedUntil: 'Date',
    createdAt: { type: 'Date', default: Date.now },
    updatedAt: { type: 'Date', default: Date.now },
    lastLogin: 'Date',
  },
  indexes: [
    { email: 1 },
    { googleId: 1 },
    { walletAddress: 1 },
    { status: 1 },
    { createdAt: -1 },
  ],
};

module.exports = {
  User,
  UserSchema,
  UserMongoSchema,
}; 