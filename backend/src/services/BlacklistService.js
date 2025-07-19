const crypto = require('crypto');
const { createLogger } = require('../middleware/observability');

/**
 * BlacklistService - Sistema de gestão de blacklist para prevenção de fraudes
 * 
 * Funcionalidades:
 * - Gestão de entidades blacklistadas (usuários, wallets, emails, IPs)
 * - Verificação em tempo real durante transações
 * - Integração com feeds de inteligência externa
 * - Logs de auditoria para compliance
 * - Diferentes níveis de bloqueio (leve, médio, pesado)
 * - Gestão de whitelist para exceções
 * 
 * Tipos de Entidades Suportadas:
 * - user: IDs de usuários do Capy Pay
 * - wallet: Endereços de carteiras blockchain
 * - email: Endereços de email suspeitos
 * - ip: Endereços IP maliciosos
 * - phone: Números de telefone suspeitos
 * - document: CPF/CNPJ fraudulentos
 * - bank_account: Contas bancárias suspeitas
 */
class BlacklistService {
    constructor() {
        // Storage em memória para MVP - em produção usar Redis/PostgreSQL
        this.blacklistEntries = new Map();
        this.whitelistEntries = new Map();
        this.auditLogs = [];
        
        // Cache para performance
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
        
        // Configurações
        this.config = {
            // Tipos de entidades suportadas
            supportedTypes: [
                'user',        // ID de usuário
                'wallet',      // Endereço de carteira
                'email',       // Endereço de email
                'ip',          // Endereço IP
                'phone',       // Número de telefone
                'document',    // CPF/CNPJ
                'bank_account' // Conta bancária
            ],
            
            // Níveis de severidade
            severityLevels: {
                LOW: 'low',           // Monitorar apenas
                MEDIUM: 'medium',     // Bloquear transações
                HIGH: 'high',         // Bloquear transações + alertar
                CRITICAL: 'critical'  // Bloquear tudo + congelar conta
            },
            
            // Fontes de dados
            sources: {
                MANUAL: 'manual',           // Adição manual
                AUTOMATED: 'automated',     // Sistema automático
                EXTERNAL: 'external',       // Feed externo
                CHAINALYSIS: 'chainalysis', // Chainalysis API
                OFAC: 'ofac',              // Lista OFAC
                BACEN: 'bacen'             // Listas BACEN
            },
            
            // Ações por severidade
            actions: {
                low: ['log', 'monitor'],
                medium: ['block_transaction', 'log', 'monitor'],
                high: ['block_transaction', 'alert_team', 'log', 'monitor'],
                critical: ['block_all', 'freeze_account', 'alert_team', 'log', 'escalate']
            }
        };

        this.logger = createLogger('blacklist_service', 'fraud-detection');
        
        // Inicializar com dados padrão
        this.initializeDefaultEntries();
        
        this.logger.info('BlacklistService initialized', {
            supportedTypes: this.config.supportedTypes.length,
            severityLevels: Object.keys(this.config.severityLevels).length,
            sources: Object.keys(this.config.sources).length
        });
    }

    /**
     * Inicializa entradas padrão da blacklist
     */
    initializeDefaultEntries() {
        // Endereços conhecidos de sanções OFAC (exemplos)
        const sanctionedWallets = [
            '0x7F367cC41522cE07553e823bf3be79A889DEbe1B', // Lazarus Group
            '0x098B716B8Aaf21512996dC57EB0615e2383E2f96', // Tornado Cash
            '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b'  // Mixer conhecido
        ];

        sanctionedWallets.forEach(wallet => {
            this.addToBlacklist('wallet', wallet, 'OFAC sanctioned address', 'critical', 'ofac', false);
        });

        // Emails de domínios suspeitos
        const suspiciousEmails = [
            '@guerrillamail.com',
            '@10minutemail.com',
            '@tempmail.org'
        ];

        suspiciousEmails.forEach(email => {
            this.addToBlacklist('email', email, 'Temporary email domain', 'medium', 'automated', false);
        });

        this.logger.info('Default blacklist entries initialized', {
            wallets: sanctionedWallets.length,
            emailDomains: suspiciousEmails.length
        });
    }

    /**
     * Verifica se uma entidade está na blacklist
     * @param {string} type - Tipo da entidade
     * @param {string} value - Valor a ser verificado
     * @param {string} correlationId - ID de correlação para logs
     * @returns {Object} Resultado da verificação
     */
    async isBlacklisted(type, value, correlationId = null) {
        try {
            // Validar parâmetros
            if (!this.config.supportedTypes.includes(type)) {
                throw new Error(`Unsupported entity type: ${type}`);
            }

            if (!value || typeof value !== 'string') {
                throw new Error('Value must be a non-empty string');
            }

            // Normalizar valor
            const normalizedValue = this.normalizeValue(type, value);
            const cacheKey = `${type}:${normalizedValue}`;

            // Verificar cache
            const cached = this.getCachedResult(cacheKey);
            if (cached) {
                this.logger.debug('Blacklist check (cached)', {
                    type,
                    value: this.maskSensitiveValue(type, normalizedValue),
                    result: cached.isBlacklisted,
                    correlationId
                });
                return cached;
            }

            // Verificar whitelist primeiro (override)
            const whitelistCheck = await this.isWhitelisted(type, normalizedValue);
            if (whitelistCheck.isWhitelisted) {
                const result = {
                    isBlacklisted: false,
                    isWhitelisted: true,
                    reason: 'Whitelisted override',
                    severity: null,
                    source: whitelistCheck.source,
                    actions: [],
                    timestamp: new Date().toISOString()
                };

                this.setCacheResult(cacheKey, result);
                
                this.logger.info('Blacklist check - whitelisted', {
                    type,
                    value: this.maskSensitiveValue(type, normalizedValue),
                    reason: whitelistCheck.reason,
                    correlationId
                });

                return result;
            }

            // Verificar blacklist
            const blacklistEntry = this.blacklistEntries.get(cacheKey);
            
            if (blacklistEntry) {
                const result = {
                    isBlacklisted: true,
                    isWhitelisted: false,
                    reason: blacklistEntry.reason,
                    severity: blacklistEntry.severity,
                    source: blacklistEntry.source,
                    actions: this.config.actions[blacklistEntry.severity] || [],
                    addedAt: blacklistEntry.addedAt,
                    addedBy: blacklistEntry.addedBy,
                    timestamp: new Date().toISOString(),
                    metadata: blacklistEntry.metadata
                };

                this.setCacheResult(cacheKey, result);

                // Log da detecção
                this.logger.warn('Blacklisted entity detected', {
                    type,
                    value: this.maskSensitiveValue(type, normalizedValue),
                    reason: blacklistEntry.reason,
                    severity: blacklistEntry.severity,
                    source: blacklistEntry.source,
                    correlationId
                });

                // Registrar auditoria
                this.logAuditEvent('blacklist_check_hit', {
                    type,
                    value: normalizedValue,
                    reason: blacklistEntry.reason,
                    severity: blacklistEntry.severity,
                    correlationId
                });

                return result;
            }

            // Não encontrado na blacklist
            const result = {
                isBlacklisted: false,
                isWhitelisted: false,
                reason: null,
                severity: null,
                source: null,
                actions: [],
                timestamp: new Date().toISOString()
            };

            this.setCacheResult(cacheKey, result);

            this.logger.debug('Blacklist check - clean', {
                type,
                value: this.maskSensitiveValue(type, normalizedValue),
                correlationId
            });

            return result;

        } catch (error) {
            this.logger.error('Error checking blacklist', {
                error: error.message,
                type,
                value: this.maskSensitiveValue(type, value),
                correlationId
            });

            // Em caso de erro, assumir como não blacklistado (fail-open)
            // mas registrar o erro para investigação
            return {
                isBlacklisted: false,
                isWhitelisted: false,
                reason: null,
                severity: null,
                source: null,
                actions: [],
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Adiciona uma entidade à blacklist
     * @param {string} type - Tipo da entidade
     * @param {string} value - Valor a ser blacklistado
     * @param {string} reason - Motivo do bloqueio
     * @param {string} severity - Severidade (low, medium, high, critical)
     * @param {string} source - Fonte da informação
     * @param {boolean} logAudit - Se deve registrar auditoria
     * @param {Object} metadata - Metadados adicionais
     * @returns {Object} Resultado da operação
     */
    addToBlacklist(type, value, reason, severity = 'medium', source = 'manual', logAudit = true, metadata = {}) {
        try {
            // Validar parâmetros
            if (!this.config.supportedTypes.includes(type)) {
                throw new Error(`Unsupported entity type: ${type}`);
            }

            if (!this.config.severityLevels[severity.toUpperCase()]) {
                throw new Error(`Invalid severity level: ${severity}`);
            }

            if (!this.config.sources[source.toUpperCase()]) {
                throw new Error(`Invalid source: ${source}`);
            }

            // Normalizar valor
            const normalizedValue = this.normalizeValue(type, value);
            const cacheKey = `${type}:${normalizedValue}`;

            // Verificar se já existe
            const existing = this.blacklistEntries.get(cacheKey);
            if (existing) {
                this.logger.warn('Entity already blacklisted', {
                    type,
                    value: this.maskSensitiveValue(type, normalizedValue),
                    existingReason: existing.reason,
                    newReason: reason
                });

                // Atualizar se nova severidade for maior
                const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
                if (severityOrder[severity] > severityOrder[existing.severity]) {
                    existing.severity = severity;
                    existing.reason = reason;
                    existing.updatedAt = new Date().toISOString();
                    existing.metadata = { ...existing.metadata, ...metadata };
                }

                return {
                    success: true,
                    action: 'updated',
                    entry: existing
                };
            }

            // Criar nova entrada
            const entry = {
                type,
                value: normalizedValue,
                reason,
                severity: severity.toLowerCase(),
                source: source.toLowerCase(),
                addedAt: new Date().toISOString(),
                addedBy: metadata.addedBy || 'system',
                metadata: {
                    ...metadata,
                    hash: this.generateEntryHash(type, normalizedValue, reason)
                }
            };

            // Adicionar à blacklist
            this.blacklistEntries.set(cacheKey, entry);

            // Limpar cache
            this.clearCacheForKey(cacheKey);

            this.logger.info('Entity added to blacklist', {
                type,
                value: this.maskSensitiveValue(type, normalizedValue),
                reason,
                severity,
                source
            });

            // Registrar auditoria
            if (logAudit) {
                this.logAuditEvent('blacklist_add', {
                    type,
                    value: normalizedValue,
                    reason,
                    severity,
                    source,
                    addedBy: entry.addedBy
                });
            }

            return {
                success: true,
                action: 'added',
                entry
            };

        } catch (error) {
            this.logger.error('Error adding to blacklist', {
                error: error.message,
                type,
                value: this.maskSensitiveValue(type, value),
                reason
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Remove uma entidade da blacklist
     * @param {string} type - Tipo da entidade
     * @param {string} value - Valor a ser removido
     * @param {string} reason - Motivo da remoção
     * @param {string} removedBy - Quem removeu
     * @returns {Object} Resultado da operação
     */
    removeFromBlacklist(type, value, reason = 'Administrative removal', removedBy = 'system') {
        try {
            // Validar parâmetros
            if (!this.config.supportedTypes.includes(type)) {
                throw new Error(`Unsupported entity type: ${type}`);
            }

            // Normalizar valor
            const normalizedValue = this.normalizeValue(type, value);
            const cacheKey = `${type}:${normalizedValue}`;

            // Verificar se existe
            const existing = this.blacklistEntries.get(cacheKey);
            if (!existing) {
                this.logger.warn('Attempted to remove non-existent blacklist entry', {
                    type,
                    value: this.maskSensitiveValue(type, normalizedValue)
                });

                return {
                    success: false,
                    error: 'Entry not found in blacklist'
                };
            }

            // Remover da blacklist
            this.blacklistEntries.delete(cacheKey);

            // Limpar cache
            this.clearCacheForKey(cacheKey);

            this.logger.info('Entity removed from blacklist', {
                type,
                value: this.maskSensitiveValue(type, normalizedValue),
                reason,
                removedBy,
                originalReason: existing.reason,
                originalSeverity: existing.severity
            });

            // Registrar auditoria
            this.logAuditEvent('blacklist_remove', {
                type,
                value: normalizedValue,
                reason,
                removedBy,
                originalEntry: existing
            });

            return {
                success: true,
                removedEntry: existing
            };

        } catch (error) {
            this.logger.error('Error removing from blacklist', {
                error: error.message,
                type,
                value: this.maskSensitiveValue(type, value)
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtém todas as entradas da blacklist
     * @param {Object} filters - Filtros para aplicar
     * @returns {Array} Lista de entradas
     */
    getBlacklistEntries(filters = {}) {
        try {
            let entries = Array.from(this.blacklistEntries.values());

            // Aplicar filtros
            if (filters.type) {
                entries = entries.filter(entry => entry.type === filters.type);
            }

            if (filters.severity) {
                entries = entries.filter(entry => entry.severity === filters.severity);
            }

            if (filters.source) {
                entries = entries.filter(entry => entry.source === filters.source);
            }

            if (filters.addedAfter) {
                const afterDate = new Date(filters.addedAfter);
                entries = entries.filter(entry => new Date(entry.addedAt) > afterDate);
            }

            if (filters.addedBefore) {
                const beforeDate = new Date(filters.addedBefore);
                entries = entries.filter(entry => new Date(entry.addedAt) < beforeDate);
            }

            // Mascarar valores sensíveis
            const maskedEntries = entries.map(entry => ({
                ...entry,
                value: this.maskSensitiveValue(entry.type, entry.value)
            }));

            this.logger.debug('Blacklist entries retrieved', {
                totalEntries: entries.length,
                filters
            });

            return {
                success: true,
                entries: maskedEntries,
                total: entries.length,
                filters
            };

        } catch (error) {
            this.logger.error('Error retrieving blacklist entries', {
                error: error.message,
                filters
            });

            return {
                success: false,
                error: error.message,
                entries: [],
                total: 0
            };
        }
    }

    /**
     * Verifica se uma entidade está na whitelist
     * @param {string} type - Tipo da entidade
     * @param {string} value - Valor a ser verificado
     * @returns {Object} Resultado da verificação
     */
    async isWhitelisted(type, value) {
        const normalizedValue = this.normalizeValue(type, value);
        const cacheKey = `${type}:${normalizedValue}`;
        
        const whitelistEntry = this.whitelistEntries.get(cacheKey);
        
        if (whitelistEntry) {
            return {
                isWhitelisted: true,
                reason: whitelistEntry.reason,
                source: whitelistEntry.source,
                addedAt: whitelistEntry.addedAt
            };
        }

        return {
            isWhitelisted: false,
            reason: null,
            source: null,
            addedAt: null
        };
    }

    /**
     * Adiciona uma entidade à whitelist
     * @param {string} type - Tipo da entidade
     * @param {string} value - Valor a ser whitelistado
     * @param {string} reason - Motivo da whitelist
     * @param {string} source - Fonte da informação
     * @param {Object} metadata - Metadados adicionais
     * @returns {Object} Resultado da operação
     */
    addToWhitelist(type, value, reason, source = 'manual', metadata = {}) {
        try {
            const normalizedValue = this.normalizeValue(type, value);
            const cacheKey = `${type}:${normalizedValue}`;

            const entry = {
                type,
                value: normalizedValue,
                reason,
                source,
                addedAt: new Date().toISOString(),
                addedBy: metadata.addedBy || 'system',
                metadata
            };

            this.whitelistEntries.set(cacheKey, entry);
            this.clearCacheForKey(cacheKey);

            this.logger.info('Entity added to whitelist', {
                type,
                value: this.maskSensitiveValue(type, normalizedValue),
                reason,
                source
            });

            return {
                success: true,
                entry
            };

        } catch (error) {
            this.logger.error('Error adding to whitelist', {
                error: error.message,
                type,
                value: this.maskSensitiveValue(type, value)
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Executa verificação em lote
     * @param {Array} entities - Lista de entidades para verificar
     * @param {string} correlationId - ID de correlação
     * @returns {Object} Resultados das verificações
     */
    async batchCheck(entities, correlationId = null) {
        try {
            const results = [];
            const blacklisted = [];
            const whitelisted = [];

            for (const entity of entities) {
                const result = await this.isBlacklisted(entity.type, entity.value, correlationId);
                
                results.push({
                    ...entity,
                    ...result
                });

                if (result.isBlacklisted) {
                    blacklisted.push(entity);
                } else if (result.isWhitelisted) {
                    whitelisted.push(entity);
                }
            }

            this.logger.info('Batch blacklist check completed', {
                totalEntities: entities.length,
                blacklistedCount: blacklisted.length,
                whitelistedCount: whitelisted.length,
                correlationId
            });

            return {
                success: true,
                results,
                summary: {
                    total: entities.length,
                    blacklisted: blacklisted.length,
                    whitelisted: whitelisted.length,
                    clean: entities.length - blacklisted.length - whitelisted.length
                },
                blacklistedEntities: blacklisted,
                whitelistedEntities: whitelisted
            };

        } catch (error) {
            this.logger.error('Error in batch blacklist check', {
                error: error.message,
                entitiesCount: entities.length,
                correlationId
            });

            return {
                success: false,
                error: error.message,
                results: []
            };
        }
    }

    /**
     * Normaliza valores para comparação consistente
     * @param {string} type - Tipo da entidade
     * @param {string} value - Valor a ser normalizado
     * @returns {string} Valor normalizado
     */
    normalizeValue(type, value) {
        if (!value) return '';

        switch (type) {
            case 'email':
                return value.toLowerCase().trim();
            
            case 'wallet':
                // Normalizar endereços Ethereum para checksum
                if (value.startsWith('0x') && value.length === 42) {
                    return value.toLowerCase();
                }
                return value.trim();
            
            case 'ip':
                return value.trim();
            
            case 'phone':
                // Remover caracteres não numéricos
                return value.replace(/\D/g, '');
            
            case 'document':
                // Remover pontuação de CPF/CNPJ
                return value.replace(/[^\d]/g, '');
            
            case 'user':
            case 'bank_account':
            default:
                return value.trim();
        }
    }

    /**
     * Mascara valores sensíveis para logs
     * @param {string} type - Tipo da entidade
     * @param {string} value - Valor a ser mascarado
     * @returns {string} Valor mascarado
     */
    maskSensitiveValue(type, value) {
        if (!value) return '';

        switch (type) {
            case 'email':
                const [user, domain] = value.split('@');
                return `${user.substring(0, 2)}***@${domain}`;
            
            case 'wallet':
                return `${value.substring(0, 6)}...${value.substring(value.length - 4)}`;
            
            case 'phone':
                return `***${value.substring(value.length - 4)}`;
            
            case 'document':
                return `***${value.substring(value.length - 4)}`;
            
            case 'ip':
                const parts = value.split('.');
                return `${parts[0]}.${parts[1]}.***`;
            
            case 'user':
                return `user_***${value.substring(value.length - 4)}`;
            
            case 'bank_account':
                return `***${value.substring(value.length - 4)}`;
            
            default:
                return `***${value.substring(Math.max(0, value.length - 4))}`;
        }
    }

    /**
     * Gera hash único para entrada
     * @param {string} type - Tipo da entidade
     * @param {string} value - Valor
     * @param {string} reason - Motivo
     * @returns {string} Hash da entrada
     */
    generateEntryHash(type, value, reason) {
        const data = `${type}:${value}:${reason}:${Date.now()}`;
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
    }

    /**
     * Obtém resultado do cache
     * @param {string} cacheKey - Chave do cache
     * @returns {Object|null} Resultado do cache ou null
     */
    getCachedResult(cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.result;
        }
        
        if (cached) {
            this.cache.delete(cacheKey);
        }
        
        return null;
    }

    /**
     * Define resultado no cache
     * @param {string} cacheKey - Chave do cache
     * @param {Object} result - Resultado a ser cacheado
     */
    setCacheResult(cacheKey, result) {
        this.cache.set(cacheKey, {
            result,
            timestamp: Date.now()
        });
    }

    /**
     * Limpa cache para uma chave específica
     * @param {string} cacheKey - Chave do cache
     */
    clearCacheForKey(cacheKey) {
        this.cache.delete(cacheKey);
    }

    /**
     * Limpa todo o cache
     */
    clearCache() {
        this.cache.clear();
        this.logger.info('Blacklist cache cleared');
    }

    /**
     * Registra evento de auditoria
     * @param {string} action - Ação realizada
     * @param {Object} details - Detalhes do evento
     */
    logAuditEvent(action, details) {
        const auditEntry = {
            id: crypto.randomUUID(),
            action,
            timestamp: new Date().toISOString(),
            details: {
                ...details,
                // Mascarar valores sensíveis na auditoria
                value: details.value ? this.maskSensitiveValue(details.type, details.value) : undefined
            }
        };

        this.auditLogs.push(auditEntry);

        // Manter apenas os últimos 10000 logs de auditoria em memória
        if (this.auditLogs.length > 10000) {
            this.auditLogs = this.auditLogs.slice(-5000);
        }

        this.logger.info('Audit event logged', {
            auditId: auditEntry.id,
            action,
            timestamp: auditEntry.timestamp
        });
    }

    /**
     * Obtém logs de auditoria
     * @param {Object} filters - Filtros para aplicar
     * @returns {Array} Logs de auditoria
     */
    getAuditLogs(filters = {}) {
        let logs = [...this.auditLogs];

        if (filters.action) {
            logs = logs.filter(log => log.action === filters.action);
        }

        if (filters.after) {
            const afterDate = new Date(filters.after);
            logs = logs.filter(log => new Date(log.timestamp) > afterDate);
        }

        if (filters.before) {
            const beforeDate = new Date(filters.before);
            logs = logs.filter(log => new Date(log.timestamp) < beforeDate);
        }

        // Ordenar por timestamp desc
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return {
            success: true,
            logs: logs.slice(0, filters.limit || 100),
            total: logs.length,
            filters
        };
    }

    /**
     * Obtém estatísticas da blacklist
     * @returns {Object} Estatísticas
     */
    getStatistics() {
        const entries = Array.from(this.blacklistEntries.values());
        
        const stats = {
            total: entries.length,
            byType: {},
            bySeverity: {},
            bySource: {},
            recentAdditions: 0
        };

        const last24h = Date.now() - (24 * 60 * 60 * 1000);

        entries.forEach(entry => {
            // Por tipo
            stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
            
            // Por severidade
            stats.bySeverity[entry.severity] = (stats.bySeverity[entry.severity] || 0) + 1;
            
            // Por fonte
            stats.bySource[entry.source] = (stats.bySource[entry.source] || 0) + 1;
            
            // Adições recentes (últimas 24h)
            if (new Date(entry.addedAt).getTime() > last24h) {
                stats.recentAdditions++;
            }
        });

        stats.cacheSize = this.cache.size;
        stats.auditLogsCount = this.auditLogs.length;
        stats.whitelistSize = this.whitelistEntries.size;

        return stats;
    }

    /**
     * Importa entradas em lote
     * @param {Array} entries - Lista de entradas para importar
     * @param {string} source - Fonte das entradas
     * @returns {Object} Resultado da importação
     */
    async bulkImport(entries, source = 'bulk_import') {
        try {
            const results = {
                success: true,
                imported: 0,
                updated: 0,
                skipped: 0,
                errors: []
            };

            for (const entry of entries) {
                try {
                    const result = this.addToBlacklist(
                        entry.type,
                        entry.value,
                        entry.reason,
                        entry.severity || 'medium',
                        source,
                        false, // Não registrar auditoria individual
                        entry.metadata || {}
                    );

                    if (result.success) {
                        if (result.action === 'added') {
                            results.imported++;
                        } else if (result.action === 'updated') {
                            results.updated++;
                        }
                    } else {
                        results.errors.push({
                            entry,
                            error: result.error
                        });
                    }
                } catch (error) {
                    results.skipped++;
                    results.errors.push({
                        entry,
                        error: error.message
                    });
                }
            }

            // Registrar auditoria do bulk import
            this.logAuditEvent('bulk_import', {
                source,
                totalEntries: entries.length,
                imported: results.imported,
                updated: results.updated,
                skipped: results.skipped,
                errors: results.errors.length
            });

            this.logger.info('Bulk import completed', {
                source,
                totalEntries: entries.length,
                results
            });

            return results;

        } catch (error) {
            this.logger.error('Error in bulk import', {
                error: error.message,
                source,
                entriesCount: entries.length
            });

            return {
                success: false,
                error: error.message,
                imported: 0,
                updated: 0,
                skipped: 0,
                errors: []
            };
        }
    }

    /**
     * Exporta entradas da blacklist
     * @param {Object} filters - Filtros para exportação
     * @returns {Object} Dados exportados
     */
    exportBlacklist(filters = {}) {
        try {
            const entriesResult = this.getBlacklistEntries(filters);
            
            if (!entriesResult.success) {
                return entriesResult;
            }

            const exportData = {
                exportedAt: new Date().toISOString(),
                filters,
                statistics: this.getStatistics(),
                entries: entriesResult.entries.map(entry => ({
                    type: entry.type,
                    value: entry.value, // Valor mascarado já
                    reason: entry.reason,
                    severity: entry.severity,
                    source: entry.source,
                    addedAt: entry.addedAt,
                    addedBy: entry.addedBy
                }))
            };

            this.logger.info('Blacklist exported', {
                entriesCount: exportData.entries.length,
                filters
            });

            return {
                success: true,
                data: exportData
            };

        } catch (error) {
            this.logger.error('Error exporting blacklist', {
                error: error.message,
                filters
            });

            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = BlacklistService; 