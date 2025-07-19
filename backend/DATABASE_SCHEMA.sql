-- ==========================================
-- CAPY PAY - DATABASE SCHEMA (PostgreSQL)
-- ==========================================
-- 
-- Este esquema suporta todas as funcionalidades do Capy Pay:
-- - Autenticação e Usuários
-- - Transações (Swaps, Boletos, Saques)
-- - KYC/AML multi-nível
-- - Tokenomics (Capy Points, Capy Coins, BRcapy)
-- - Programa de Referência
-- - Notificações
-- - Blacklist e Detecção de Fraudes
-- - Observabilidade e Auditoria
--
-- Versão: 1.0.0
-- Criado em: 2024-01-15

-- ==========================================
-- EXTENSÕES E CONFIGURAÇÕES
-- ==========================================

-- UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crypto functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- JSON functions
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Full text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Timezone
SET timezone = 'UTC';

-- ==========================================
-- TIPOS CUSTOMIZADOS (ENUMS)
-- ==========================================

-- Status de KYC
CREATE TYPE kyc_status AS ENUM (
    'NONE',
    'LEVEL_1',
    'LEVEL_2', 
    'LEVEL_3',
    'PENDING',
    'UNDER_REVIEW',
    'VERIFIED',
    'REJECTED',
    'EXPIRED'
);

-- Tipos de transação
CREATE TYPE transaction_type AS ENUM (
    'crypto_swap',
    'boleto_payment',
    'withdrawal',
    'deposit',
    'pix_transfer',
    'internal_transfer'
);

-- Status de transação
CREATE TYPE transaction_status AS ENUM (
    'pending',
    'pending_confirmation',
    'pending_deposit',
    'processing',
    'completed',
    'failed',
    'cancelled',
    'refunded',
    'expired'
);

-- Tipos de entidades blacklist
CREATE TYPE blacklist_entity_type AS ENUM (
    'user',
    'wallet',
    'email',
    'ip',
    'phone',
    'document',
    'bank_account'
);

-- Severidade blacklist
CREATE TYPE blacklist_severity AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

-- Fonte blacklist
CREATE TYPE blacklist_source AS ENUM (
    'manual',
    'automated',
    'external',
    'chainalysis',
    'ofac',
    'bacen'
);

-- Níveis de risco fraude
CREATE TYPE risk_level AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL',
    'UNKNOWN'
);

-- Decisões de fraude
CREATE TYPE fraud_decision AS ENUM (
    'ALLOW',
    'REVIEW',
    'BLOCK'
);

-- Status de casos de investigação
CREATE TYPE case_status AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'CLOSED',
    'ESCALATED'
);

-- Tipos de notificação
CREATE TYPE notification_type AS ENUM (
    'transaction_completed',
    'transaction_failed',
    'kyc_approved',
    'kyc_rejected',
    'referral_reward',
    'security_alert',
    'system_maintenance',
    'marketing'
);

-- Status de notificação
CREATE TYPE notification_status AS ENUM (
    'pending',
    'sent',
    'delivered',
    'failed',
    'cancelled'
);

-- ==========================================
-- TABELA: users
-- ==========================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Dados do Google OAuth
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    picture TEXT,
    
    -- Carteira custodial
    wallet_address VARCHAR(42) UNIQUE, -- Endereço Ethereum
    encrypted_private_key TEXT, -- Chave privada criptografada com AES-256
    wallet_created_at TIMESTAMPTZ,
    
    -- Status KYC
    kyc_level kyc_status DEFAULT 'NONE',
    kyc_status kyc_status DEFAULT 'NONE',
    kyc_verified_at TIMESTAMPTZ,
    kyc_expires_at TIMESTAMPTZ,
    
    -- Dados KYC (JSON criptografado)
    kyc_data JSONB DEFAULT '{}',
    
    -- Preferências do usuário
    preferences JSONB DEFAULT '{
        "language": "pt-BR",
        "notifications": true,
        "marketing": false,
        "timezone": "America/Sao_Paulo"
    }',
    
    -- Flags de segurança
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    review_required BOOLEAN DEFAULT FALSE,
    
    -- Programa de referência
    referral_code VARCHAR(50) UNIQUE,
    referred_by UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    
    -- Índices
    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_wallet_address_check CHECK (wallet_address ~* '^0x[a-fA-F0-9]{40}$')
);

-- Índices para users
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_kyc_level ON users(kyc_level);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_referred_by ON users(referred_by);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_is_flagged ON users(is_flagged);

-- ==========================================
-- TABELA: user_sessions
-- ==========================================

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Dados da sessão
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    
    -- Informações do dispositivo/cliente
    user_agent TEXT,
    ip_address INET,
    
    -- MiniKit/Telegram data
    minikit_data JSONB DEFAULT '{}',
    
    -- Status da sessão
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- Índices para user_sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_is_active ON user_sessions(is_active);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- ==========================================
-- TABELA: transactions
-- ==========================================

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Tipo e status
    type transaction_type NOT NULL,
    status transaction_status DEFAULT 'pending',
    
    -- Valores
    input_amount DECIMAL(20,8) NOT NULL CHECK (input_amount > 0),
    input_currency VARCHAR(10) NOT NULL,
    output_amount DECIMAL(20,8),
    output_currency VARCHAR(10),
    
    -- Taxa de câmbio e fees
    exchange_rate DECIMAL(20,8),
    fee_amount DECIMAL(20,8) DEFAULT 0,
    fee_currency VARCHAR(10),
    
    -- Referências externas
    blockchain_tx_hash VARCHAR(66), -- Hash da transação blockchain
    external_ref_id VARCHAR(255), -- ID no StarkBank, 1inch, etc.
    correlation_id VARCHAR(255), -- Para rastreamento
    
    -- Detalhes específicos (JSON)
    details JSONB DEFAULT '{}',
    
    -- Análise de fraude
    fraud_analysis JSONB DEFAULT '{}',
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level risk_level DEFAULT 'LOW',
    fraud_decision fraud_decision DEFAULT 'ALLOW',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

-- Índices para transactions
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_blockchain_tx_hash ON transactions(blockchain_tx_hash);
CREATE INDEX idx_transactions_external_ref_id ON transactions(external_ref_id);
CREATE INDEX idx_transactions_correlation_id ON transactions(correlation_id);
CREATE INDEX idx_transactions_risk_level ON transactions(risk_level);
CREATE INDEX idx_transactions_fraud_decision ON transactions(fraud_decision);

-- ==========================================
-- TABELA: user_balances
-- ==========================================

CREATE TABLE user_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Saldos dos tokens
    capy_points BIGINT DEFAULT 0 CHECK (capy_points >= 0),
    capy_coins DECIMAL(20,8) DEFAULT 0 CHECK (capy_coins >= 0),
    brcapy_balance DECIMAL(20,8) DEFAULT 0 CHECK (brcapy_balance >= 0),
    
    -- Saldos pendentes
    capy_points_pending BIGINT DEFAULT 0 CHECK (capy_points_pending >= 0),
    capy_coins_pending DECIMAL(20,8) DEFAULT 0 CHECK (capy_coins_pending >= 0),
    brcapy_pending DECIMAL(20,8) DEFAULT 0 CHECK (brcapy_pending >= 0),
    
    -- Yield da BRcapy
    brcapy_yield_earned_daily DECIMAL(20,8) DEFAULT 0,
    brcapy_yield_earned_monthly DECIMAL(20,8) DEFAULT 0,
    brcapy_yield_earned_total DECIMAL(20,8) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: um registro por usuário
    UNIQUE(user_id)
);

-- Índices para user_balances
CREATE INDEX idx_user_balances_user_id ON user_balances(user_id);

-- ==========================================
-- TABELA: balance_history
-- ==========================================

CREATE TABLE balance_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Tipo de operação
    operation_type VARCHAR(50) NOT NULL, -- 'earn', 'spend', 'convert', 'distribute', 'redeem'
    
    -- Valores alterados
    capy_points_change BIGINT DEFAULT 0,
    capy_coins_change DECIMAL(20,8) DEFAULT 0,
    brcapy_change DECIMAL(20,8) DEFAULT 0,
    
    -- Saldos após a operação
    capy_points_balance BIGINT,
    capy_coins_balance DECIMAL(20,8),
    brcapy_balance DECIMAL(20,8),
    
    -- Motivo e referências
    reason VARCHAR(255) NOT NULL,
    transaction_id UUID REFERENCES transactions(id),
    referral_id UUID,
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para balance_history
CREATE INDEX idx_balance_history_user_id ON balance_history(user_id);
CREATE INDEX idx_balance_history_operation_type ON balance_history(operation_type);
CREATE INDEX idx_balance_history_transaction_id ON balance_history(transaction_id);
CREATE INDEX idx_balance_history_created_at ON balance_history(created_at);

-- ==========================================
-- TABELA: referrals
-- ==========================================

CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES users(id),
    referred_user_id UUID NOT NULL REFERENCES users(id),
    
    -- Status da indicação
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'pending'
    
    -- Marcos importantes
    kyc_completed BOOLEAN DEFAULT FALSE,
    kyc_completed_at TIMESTAMPTZ,
    first_transaction_completed BOOLEAN DEFAULT FALSE,
    first_transaction_at TIMESTAMPTZ,
    
    -- Estatísticas
    total_transactions INTEGER DEFAULT 0,
    total_volume DECIMAL(20,8) DEFAULT 0,
    
    -- Recompensas ganhas (JSON)
    rewards_earned JSONB DEFAULT '{
        "capy_points": 0,
        "capy_coins": 0,
        "brcapy": 0
    }',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(referrer_id, referred_user_id),
    CHECK(referrer_id != referred_user_id)
);

-- Índices para referrals
CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred_user_id ON referrals(referred_user_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_created_at ON referrals(created_at);

-- ==========================================
-- TABELA: notification_tokens
-- ==========================================

CREATE TABLE notification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Dados do MiniKit/Telegram
    frame_url TEXT NOT NULL,
    frame_token TEXT NOT NULL,
    
    -- Informações do dispositivo
    platform VARCHAR(50) DEFAULT 'telegram',
    device_info JSONB DEFAULT '{}',
    
    -- Preferências de notificação
    preferences JSONB DEFAULT '{
        "transaction_updates": true,
        "kyc_updates": true,
        "referral_updates": true,
        "marketing_messages": false,
        "daily_summary": true
    }',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: um token ativo por usuário
    UNIQUE(user_id, platform)
);

-- Índices para notification_tokens
CREATE INDEX idx_notification_tokens_user_id ON notification_tokens(user_id);
CREATE INDEX idx_notification_tokens_platform ON notification_tokens(platform);
CREATE INDEX idx_notification_tokens_is_active ON notification_tokens(is_active);

-- ==========================================
-- TABELA: notifications
-- ==========================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Conteúdo da notificação
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Status e canal
    status notification_status DEFAULT 'pending',
    channel VARCHAR(50) DEFAULT 'telegram',
    
    -- Referências
    transaction_id UUID REFERENCES transactions(id),
    referral_id UUID REFERENCES referrals(id),
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    
    -- Retry logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ
);

-- Índices para notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_transaction_id ON notifications(transaction_id);

-- ==========================================
-- TABELA: blacklist
-- ==========================================

CREATE TABLE blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Entidade blacklistada
    entity_type blacklist_entity_type NOT NULL,
    entity_value TEXT NOT NULL,
    entity_value_hash VARCHAR(64) NOT NULL, -- SHA-256 hash para indexação
    
    -- Detalhes da blacklist
    reason TEXT NOT NULL,
    severity blacklist_severity DEFAULT 'medium',
    source blacklist_source DEFAULT 'manual',
    
    -- Quem adicionou
    added_by UUID, -- Pode ser NULL para imports automáticos
    added_by_email VARCHAR(255),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ,
    
    -- Constraints
    UNIQUE(entity_type, entity_value_hash)
);

-- Índices para blacklist
CREATE INDEX idx_blacklist_entity_type ON blacklist(entity_type);
CREATE INDEX idx_blacklist_entity_value_hash ON blacklist(entity_value_hash);
CREATE INDEX idx_blacklist_severity ON blacklist(severity);
CREATE INDEX idx_blacklist_source ON blacklist(source);
CREATE INDEX idx_blacklist_is_active ON blacklist(is_active);
CREATE INDEX idx_blacklist_created_at ON blacklist(created_at);

-- ==========================================
-- TABELA: whitelist
-- ==========================================

CREATE TABLE whitelist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Entidade whitelistada
    entity_type blacklist_entity_type NOT NULL,
    entity_value TEXT NOT NULL,
    entity_value_hash VARCHAR(64) NOT NULL,
    
    -- Detalhes
    reason TEXT NOT NULL,
    source blacklist_source DEFAULT 'manual',
    
    -- Quem adicionou
    added_by UUID,
    added_by_email VARCHAR(255),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(entity_type, entity_value_hash)
);

-- Índices para whitelist
CREATE INDEX idx_whitelist_entity_type ON whitelist(entity_type);
CREATE INDEX idx_whitelist_entity_value_hash ON whitelist(entity_value_hash);
CREATE INDEX idx_whitelist_is_active ON whitelist(is_active);

-- ==========================================
-- TABELA: fraud_cases
-- ==========================================

CREATE TABLE fraud_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Tipo e status do caso
    case_type VARCHAR(50) NOT NULL, -- 'BLACKLIST_CRITICAL', 'RISK_REVIEW', etc.
    status case_status DEFAULT 'OPEN',
    priority risk_level DEFAULT 'MEDIUM',
    
    -- Entidades relacionadas
    user_id UUID REFERENCES users(id),
    transaction_id UUID REFERENCES transactions(id),
    
    -- Análise de risco
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_reasons TEXT[],
    
    -- Investigação
    assigned_to VARCHAR(255),
    investigator_notes TEXT[],
    
    -- Evidências (JSON)
    evidence JSONB DEFAULT '{}',
    
    -- Resolução
    resolution TEXT,
    resolution_action VARCHAR(100), -- 'cleared', 'blocked', 'restricted', etc.
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    
    -- SLA tracking
    estimated_resolution_time TIMESTAMPTZ,
    sla_breached BOOLEAN DEFAULT FALSE
);

-- Índices para fraud_cases
CREATE INDEX idx_fraud_cases_status ON fraud_cases(status);
CREATE INDEX idx_fraud_cases_priority ON fraud_cases(priority);
CREATE INDEX idx_fraud_cases_user_id ON fraud_cases(user_id);
CREATE INDEX idx_fraud_cases_transaction_id ON fraud_cases(transaction_id);
CREATE INDEX idx_fraud_cases_assigned_to ON fraud_cases(assigned_to);
CREATE INDEX idx_fraud_cases_created_at ON fraud_cases(created_at);

-- ==========================================
-- TABELA: daily_limits
-- ==========================================

CREATE TABLE daily_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Data do limite
    date DATE NOT NULL,
    
    -- Volumes utilizados
    daily_volume_usd DECIMAL(20,8) DEFAULT 0 CHECK (daily_volume_usd >= 0),
    daily_transaction_count INTEGER DEFAULT 0 CHECK (daily_transaction_count >= 0),
    
    -- Limites aplicáveis (baseados no KYC level)
    kyc_level kyc_status NOT NULL,
    max_daily_volume DECIMAL(20,8) NOT NULL,
    max_daily_transactions INTEGER NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: um registro por usuário por data
    UNIQUE(user_id, date)
);

-- Índices para daily_limits
CREATE INDEX idx_daily_limits_user_id ON daily_limits(user_id);
CREATE INDEX idx_daily_limits_date ON daily_limits(date);
CREATE INDEX idx_daily_limits_kyc_level ON daily_limits(kyc_level);

-- ==========================================
-- TABELA: system_config
-- ==========================================

CREATE TABLE system_config (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    
    -- Versionamento
    version INTEGER DEFAULT 1,
    
    -- Metadados
    category VARCHAR(100), -- 'brcapy', 'kyc_limits', 'fees', etc.
    is_sensitive BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by VARCHAR(255)
);

-- Índices para system_config
CREATE INDEX idx_system_config_category ON system_config(category);
CREATE INDEX idx_system_config_updated_at ON system_config(updated_at);

-- ==========================================
-- TABELA: brcapy_history
-- ==========================================

CREATE TABLE brcapy_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Data e valor
    date DATE NOT NULL UNIQUE,
    value DECIMAL(20,12) NOT NULL CHECK (value > 0),
    
    -- Variação
    previous_value DECIMAL(20,12),
    daily_change DECIMAL(20,12) DEFAULT 0,
    daily_change_percent DECIMAL(10,6) DEFAULT 0,
    
    -- Componentes do yield
    cdi_rate DECIMAL(10,6) NOT NULL,
    internal_fees DECIMAL(10,6) DEFAULT 0,
    total_apy DECIMAL(10,6) NOT NULL,
    
    -- Métricas do pool
    total_supply DECIMAL(20,8) DEFAULT 0,
    pool_value_brl DECIMAL(20,8) DEFAULT 0,
    pool_utilization DECIMAL(5,4) DEFAULT 0,
    
    -- Volume de transações
    daily_volume DECIMAL(20,8) DEFAULT 0,
    daily_transactions INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para brcapy_history
CREATE INDEX idx_brcapy_history_date ON brcapy_history(date DESC);
CREATE INDEX idx_brcapy_history_created_at ON brcapy_history(created_at);

-- ==========================================
-- TABELA: audit_logs
-- ==========================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Ação realizada
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL, -- 'user', 'transaction', 'blacklist', etc.
    resource_id UUID,
    
    -- Ator
    actor_type VARCHAR(50) NOT NULL, -- 'user', 'admin', 'system'
    actor_id UUID,
    actor_email VARCHAR(255),
    
    -- Contexto
    ip_address INET,
    user_agent TEXT,
    correlation_id VARCHAR(255),
    
    -- Dados da mudança
    old_values JSONB,
    new_values JSONB,
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    
    -- Compliance
    regulation VARCHAR(50), -- 'BACEN', 'COAF', 'OFAC', 'LGPD'
    retention_period VARCHAR(20) DEFAULT '7_years',
    classification VARCHAR(20) DEFAULT 'confidential', -- 'public', 'internal', 'confidential', 'restricted'
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para audit_logs
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_correlation_id ON audit_logs(correlation_id);
CREATE INDEX idx_audit_logs_regulation ON audit_logs(regulation);

-- ==========================================
-- VIEWS ÚTEIS
-- ==========================================

-- View: Usuários com saldos atuais
CREATE VIEW users_with_balances AS
SELECT 
    u.id,
    u.email,
    u.name,
    u.wallet_address,
    u.kyc_level,
    u.kyc_status,
    u.created_at,
    COALESCE(ub.capy_points, 0) as capy_points,
    COALESCE(ub.capy_coins, 0) as capy_coins,
    COALESCE(ub.brcapy_balance, 0) as brcapy_balance
FROM users u
LEFT JOIN user_balances ub ON u.id = ub.user_id
WHERE u.deleted_at IS NULL;

-- View: Transações com dados do usuário
CREATE VIEW transactions_with_user AS
SELECT 
    t.*,
    u.email as user_email,
    u.name as user_name,
    u.kyc_level as user_kyc_level
FROM transactions t
JOIN users u ON t.user_id = u.id;

-- View: Estatísticas diárias de transações
CREATE VIEW daily_transaction_stats AS
SELECT 
    DATE(created_at) as date,
    type,
    status,
    COUNT(*) as transaction_count,
    SUM(input_amount) as total_volume,
    AVG(input_amount) as avg_amount,
    AVG(risk_score) as avg_risk_score
FROM transactions
GROUP BY DATE(created_at), type, status
ORDER BY date DESC, type;

-- View: Blacklist ativa
CREATE VIEW active_blacklist AS
SELECT 
    entity_type,
    entity_value,
    reason,
    severity,
    source,
    created_at
FROM blacklist
WHERE is_active = TRUE
ORDER BY severity DESC, created_at DESC;

-- ==========================================
-- FUNÇÕES AUXILIARES
-- ==========================================

-- Função: Gerar código de referência único
CREATE OR REPLACE FUNCTION generate_referral_code(user_name TEXT)
RETURNS TEXT AS $$
DECLARE
    clean_name TEXT;
    base_code TEXT;
    final_code TEXT;
    counter INTEGER := 0;
BEGIN
    -- Limpar nome (apenas letras e números)
    clean_name := UPPER(REGEXP_REPLACE(user_name, '[^A-Za-z0-9]', '', 'g'));
    
    -- Limitar a 10 caracteres
    clean_name := LEFT(clean_name, 10);
    
    -- Criar código base
    base_code := 'CAPY-' || clean_name || '-' || EXTRACT(YEAR FROM NOW());
    
    -- Verificar se já existe
    LOOP
        final_code := base_code;
        IF counter > 0 THEN
            final_code := final_code || '-' || counter;
        END IF;
        
        -- Verificar se código já existe
        IF NOT EXISTS (SELECT 1 FROM users WHERE referral_code = final_code) THEN
            EXIT;
        END IF;
        
        counter := counter + 1;
    END LOOP;
    
    RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- Função: Calcular hash de entidade para blacklist
CREATE OR REPLACE FUNCTION calculate_entity_hash(entity_type TEXT, entity_value TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(digest(entity_type || ':' || LOWER(TRIM(entity_value)), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Função: Atualizar timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Trigger: Atualizar updated_at em users
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Atualizar updated_at em transactions
CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Atualizar updated_at em user_balances
CREATE TRIGGER update_user_balances_updated_at 
    BEFORE UPDATE ON user_balances 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Gerar código de referência ao criar usuário
CREATE OR REPLACE FUNCTION generate_user_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_referral_code(NEW.name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_referral_code_trigger
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION generate_user_referral_code();

-- Trigger: Calcular hash de entidade na blacklist
CREATE OR REPLACE FUNCTION calculate_blacklist_hash()
RETURNS TRIGGER AS $$
BEGIN
    NEW.entity_value_hash := calculate_entity_hash(NEW.entity_type::TEXT, NEW.entity_value);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_blacklist_hash_trigger
    BEFORE INSERT OR UPDATE ON blacklist
    FOR EACH ROW
    EXECUTE FUNCTION calculate_blacklist_hash();

-- Trigger: Calcular hash de entidade na whitelist
CREATE TRIGGER calculate_whitelist_hash_trigger
    BEFORE INSERT OR UPDATE ON whitelist
    FOR EACH ROW
    EXECUTE FUNCTION calculate_blacklist_hash();

-- ==========================================
-- DADOS INICIAIS (SEEDS)
-- ==========================================

-- Configurações do sistema
INSERT INTO system_config (key, value, description, category) VALUES
('brcapy.cdi_rate', '11.75', 'Taxa CDI atual (%)', 'brcapy'),
('brcapy.internal_fees', '1.10', 'Taxas internas (%)', 'brcapy'),
('brcapy.current_value', '1.05234567', 'Valor atual da BRcapy em BRL', 'brcapy'),
('brcapy.total_supply', '50000000.00', 'Supply total da BRcapy', 'brcapy'),

('kyc.level_none.daily_limit', '1000.00', 'Limite diário KYC None', 'kyc_limits'),
('kyc.level_none.monthly_limit', '5000.00', 'Limite mensal KYC None', 'kyc_limits'),
('kyc.level_1.daily_limit', '5000.00', 'Limite diário KYC Level 1', 'kyc_limits'),
('kyc.level_1.monthly_limit', '50000.00', 'Limite mensal KYC Level 1', 'kyc_limits'),
('kyc.level_2.daily_limit', '25000.00', 'Limite diário KYC Level 2', 'kyc_limits'),
('kyc.level_2.monthly_limit', '200000.00', 'Limite mensal KYC Level 2', 'kyc_limits'),
('kyc.level_3.daily_limit', '100000.00', 'Limite diário KYC Level 3', 'kyc_limits'),
('kyc.level_3.monthly_limit', '1000000.00', 'Limite mensal KYC Level 3', 'kyc_limits'),

('fees.platform_swap', '0.3', 'Taxa da plataforma para swaps (%)', 'fees'),
('fees.platform_boleto', '1.5', 'Taxa da plataforma para boletos (%)', 'fees'),
('fees.starkbank_boleto', '2.50', 'Taxa do StarkBank para boletos (BRL)', 'fees'),

('referral.signup_points', '100', 'Pontos por cadastro de indicado', 'referral'),
('referral.first_tx_coins', '5.0', 'Coins pela primeira transação', 'referral'),
('referral.monthly_brcapy', '10.0', 'BRcapy por indicado ativo mensal', 'referral'),

('tokenomics.points_to_coins_rate', '100', 'Taxa de conversão Points para Coins', 'tokenomics'),
('tokenomics.coins_to_points_rate', '100', 'Taxa de conversão Coins para Points', 'tokenomics');

-- Blacklist inicial (endereços OFAC conhecidos)
INSERT INTO blacklist (entity_type, entity_value, reason, severity, source, added_by_email) VALUES
('wallet', '0x7F367cC41522cE07553e823bf3be79A889DEbe1B', 'OFAC sanctioned address - Lazarus Group', 'critical', 'ofac', 'system@capypay.com'),
('wallet', '0x098B716B8Aaf21512996dC57EB0615e2383E2f96', 'OFAC sanctioned address - Tornado Cash', 'critical', 'ofac', 'system@capypay.com'),
('wallet', '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b', 'Known mixer address', 'high', 'chainalysis', 'system@capypay.com'),

('email', '@guerrillamail.com', 'Temporary email domain', 'medium', 'automated', 'system@capypay.com'),
('email', '@10minutemail.com', 'Temporary email domain', 'medium', 'automated', 'system@capypay.com'),
('email', '@tempmail.org', 'Temporary email domain', 'medium', 'automated', 'system@capypay.com');

-- Valor inicial da BRcapy
INSERT INTO brcapy_history (date, value, cdi_rate, internal_fees, total_apy, total_supply, pool_value_brl) VALUES
(CURRENT_DATE, 1.05234567, 11.75, 1.10, 12.85, 50000000.00, 52617283.50);

-- ==========================================
-- ÍNDICES COMPOSTOS PARA PERFORMANCE
-- ==========================================

-- Índices para queries comuns de transações
CREATE INDEX idx_transactions_user_status_created ON transactions(user_id, status, created_at DESC);
CREATE INDEX idx_transactions_type_status_created ON transactions(type, status, created_at DESC);

-- Índices para fraud analysis
CREATE INDEX idx_transactions_risk_level_created ON transactions(risk_level, created_at DESC);
CREATE INDEX idx_transactions_fraud_decision_created ON transactions(fraud_decision, created_at DESC);

-- Índices para referrals
CREATE INDEX idx_referrals_referrer_status ON referrals(referrer_id, status);

-- Índices para audit logs (compliance)
CREATE INDEX idx_audit_logs_regulation_created ON audit_logs(regulation, created_at DESC);
CREATE INDEX idx_audit_logs_actor_action ON audit_logs(actor_id, action);

-- ==========================================
-- POLÍTICAS DE RETENÇÃO (RLS - Row Level Security)
-- ==========================================

-- Habilitar RLS para tabelas sensíveis
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas seus próprios dados
CREATE POLICY users_self_access ON users
    FOR ALL
    TO authenticated_user
    USING (id = current_user_id());

CREATE POLICY transactions_self_access ON transactions
    FOR ALL
    TO authenticated_user
    USING (user_id = current_user_id());

CREATE POLICY balances_self_access ON user_balances
    FOR ALL
    TO authenticated_user
    USING (user_id = current_user_id());

-- Política: Admins podem ver tudo
CREATE POLICY admin_full_access ON users
    FOR ALL
    TO admin_user
    USING (true);

CREATE POLICY admin_full_access_transactions ON transactions
    FOR ALL
    TO admin_user
    USING (true);

-- ==========================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ==========================================

COMMENT ON TABLE users IS 'Tabela principal de usuários com dados do Google OAuth e carteira custodial';
COMMENT ON TABLE transactions IS 'Todas as transações do sistema (swaps, boletos, saques)';
COMMENT ON TABLE user_balances IS 'Saldos atuais de tokens por usuário';
COMMENT ON TABLE blacklist IS 'Entidades blacklistadas para prevenção de fraudes';
COMMENT ON TABLE fraud_cases IS 'Casos de investigação de fraude';
COMMENT ON TABLE audit_logs IS 'Logs de auditoria para compliance (LGPD, BACEN, COAF)';

-- ==========================================
-- VACUUM E ANALYZE INICIAL
-- ==========================================

VACUUM ANALYZE;

-- ==========================================
-- BACKUP E RECOVERY SETUP
-- ==========================================

-- Configurar backup automático
-- pg_dump capypay_production | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

-- ==========================================
-- MONITORAMENTO E PERFORMANCE
-- ==========================================

-- Criar extensão para estatísticas
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View para monitorar queries lentas
CREATE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    stddev_time
FROM pg_stat_statements
WHERE mean_time > 1000 -- Queries com média > 1s
ORDER BY mean_time DESC;

-- ==========================================
-- FINALIZAÇÃO
-- ==========================================

-- Atualizar estatísticas
ANALYZE;

-- Log de criação
INSERT INTO audit_logs (action, resource_type, actor_type, actor_email, metadata) VALUES
('schema_created', 'database', 'system', 'system@capypay.com', 
'{"version": "1.0.0", "tables_created": 15, "indexes_created": 50, "functions_created": 5}');

COMMIT;

-- ==========================================
-- SCHEMA VERSION
-- ==========================================

INSERT INTO system_config (key, value, description, category) VALUES
('schema.version', '"1.0.0"', 'Versão atual do schema do banco', 'system'),
('schema.created_at', '"2024-01-15T14:30:45.123Z"', 'Data de criação do schema', 'system'),
('schema.last_migration', '"initial"', 'Última migração aplicada', 'system'); 