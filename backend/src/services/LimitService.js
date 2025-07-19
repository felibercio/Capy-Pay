const winston = require('winston');
const BigNumber = require('bignumber.js');

/**
 * LimitService - Gerencia limites de transação baseados em KYC/AML
 * 
 * Funcionalidades:
 * - Verificação de limites por período (diário, semanal, mensal, anual)
 * - Controle de volume por tipo de transação
 * - Integração com níveis KYC
 * - Monitoramento de padrões suspeitos
 * - Compliance com regulamentações financeiras
 */
class LimitService {
    constructor(kycService) {
        this.kycService = kycService;
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/limits.log' }),
                new winston.transports.Console()
            ]
        });

        // Configuração de limites por tipo de transação
        this.transactionTypes = {
            DEPOSIT: {
                name: 'Depósito',
                riskMultiplier: 0.8, // Menor risco
                amlRequired: false
            },
            SWAP: {
                name: 'Troca de Criptomoedas',
                riskMultiplier: 1.0, // Risco padrão
                amlRequired: true
            },
            WITHDRAWAL: {
                name: 'Saque',
                riskMultiplier: 1.5, // Maior risco
                amlRequired: true
            },
            BILL_PAYMENT: {
                name: 'Pagamento de Conta',
                riskMultiplier: 1.2, // Risco moderado
                amlRequired: true
            },
            P2P_TRANSFER: {
                name: 'Transferência P2P',
                riskMultiplier: 1.8, // Alto risco
                amlRequired: true
            }
        };

        // Períodos de controle
        this.periods = {
            DAILY: { name: 'Diário', hours: 24 },
            WEEKLY: { name: 'Semanal', hours: 24 * 7 },
            MONTHLY: { name: 'Mensal', hours: 24 * 30 },
            ANNUAL: { name: 'Anual', hours: 24 * 365 }
        };

        // Limites especiais para transações de alto valor
        this.highValueThresholds = {
            NONE: 100,       // R$ 100
            LEVEL_1: 1000,   // R$ 1.000
            LEVEL_2: 10000,  // R$ 10.000
            LEVEL_3: 50000   // R$ 50.000
        };

        // Storage em memória para MVP - substituir por banco de dados
        this.userTransactionVolumes = new Map(); // userId -> { period -> { type -> volume } }
        this.transactionHistory = new Map(); // userId -> Array<{ amount, type, timestamp, status }>
        this.suspiciousActivity = new Map(); // userId -> Array<{ pattern, severity, timestamp }>

        this.logger.info('LimitService initialized with compliance monitoring');
    }

    /**
     * Verifica se uma transação está dentro dos limites do usuário
     * @param {string} userId - ID do usuário
     * @param {number} transactionAmount - Valor da transação
     * @param {string} transactionType - Tipo da transação
     * @param {Object} metadata - Metadados adicionais
     * @returns {Promise<Object>} - Resultado da verificação
     */
    async checkTransactionLimit(userId, transactionAmount, transactionType, metadata = {}) {
        try {
            const amount = new BigNumber(transactionAmount);
            
            if (amount.isLessThanOrEqualTo(0)) {
                return {
                    success: false,
                    error: 'Valor da transação deve ser maior que zero',
                    code: 'INVALID_AMOUNT'
                };
            }

            // Obter status KYC do usuário
            const kycStatus = await this.kycService.checkUserKYCStatus(userId);
            
            if (!kycStatus.success) {
                return {
                    success: false,
                    error: 'Erro ao verificar status KYC',
                    code: 'KYC_ERROR'
                };
            }

            // Obter limites para o nível KYC atual
            const limits = this.getKYCLimits(kycStatus.currentLevel);
            const transactionConfig = this.transactionTypes[transactionType.toUpperCase()];

            if (!transactionConfig) {
                return {
                    success: false,
                    error: 'Tipo de transação não suportado',
                    code: 'INVALID_TRANSACTION_TYPE'
                };
            }

            // Verificar se KYC está aprovado para transações que exigem AML
            if (transactionConfig.amlRequired && 
                kycStatus.status !== 'verified' && 
                kycStatus.currentLevel === 'NONE') {
                return {
                    success: false,
                    error: 'Verificação de identidade necessária para este tipo de transação',
                    code: 'KYC_REQUIRED',
                    requiredLevel: 'LEVEL_1',
                    currentLevel: kycStatus.currentLevel
                };
            }

            // Obter volumes de transação atuais
            const currentVolumes = await this.getUserTransactionVolumes(userId);

            // Verificar limites por período
            const limitChecks = await this.checkAllPeriodLimits(
                currentVolumes,
                limits,
                amount,
                transactionType,
                transactionConfig.riskMultiplier
            );

            // Verificar se algum limite foi excedido
            const exceededLimits = limitChecks.filter(check => !check.withinLimit);
            
            if (exceededLimits.length > 0) {
                const mostRestrictive = exceededLimits[0];
                
                return {
                    success: false,
                    error: `Limite ${mostRestrictive.period.toLowerCase()} excedido`,
                    code: 'LIMIT_EXCEEDED',
                    details: {
                        period: mostRestrictive.period,
                        currentVolume: mostRestrictive.currentVolume.toFixed(2),
                        limit: mostRestrictive.limit.toFixed(2),
                        remaining: mostRestrictive.remaining.toFixed(2),
                        transactionAmount: amount.toFixed(2)
                    },
                    upgradeOptions: this.getUpgradeOptions(kycStatus.currentLevel),
                    limitChecks: limitChecks.map(check => ({
                        period: check.period,
                        withinLimit: check.withinLimit,
                        utilization: check.utilization
                    }))
                };
            }

            // Verificar transação de alto valor
            const highValueCheck = await this.checkHighValueTransaction(
                userId,
                amount,
                kycStatus.currentLevel,
                metadata
            );

            if (!highValueCheck.approved) {
                return {
                    success: false,
                    error: highValueCheck.reason,
                    code: 'HIGH_VALUE_BLOCKED',
                    details: highValueCheck.details,
                    requiredActions: highValueCheck.requiredActions
                };
            }

            // Verificar padrões suspeitos
            const suspiciousCheck = await this.checkSuspiciousActivity(
                userId,
                amount,
                transactionType,
                metadata
            );

            if (suspiciousCheck.flagged) {
                // Log para compliance mas não bloquear automaticamente
                this.logger.warn('Suspicious activity detected', {
                    userId,
                    amount: amount.toFixed(2),
                    transactionType,
                    patterns: suspiciousCheck.patterns,
                    riskScore: suspiciousCheck.riskScore
                });

                // Se muito suspeito, bloquear
                if (suspiciousCheck.riskScore > 80) {
                    return {
                        success: false,
                        error: 'Transação bloqueada por análise de risco',
                        code: 'RISK_BLOCKED',
                        details: {
                            riskScore: suspiciousCheck.riskScore,
                            patterns: suspiciousCheck.patterns
                        }
                    };
                }
            }

            // Calcular utilização dos limites após a transação
            const utilizationAfter = limitChecks.map(check => ({
                period: check.period,
                utilizationBefore: check.utilization,
                utilizationAfter: ((check.currentVolume.plus(amount)).dividedBy(check.limit)).multipliedBy(100).toFixed(1) + '%'
            }));

            this.logger.info('Transaction limit check passed', {
                userId,
                amount: amount.toFixed(2),
                transactionType,
                kycLevel: kycStatus.currentLevel,
                utilizationAfter
            });

            return {
                success: true,
                approved: true,
                kycLevel: kycStatus.currentLevel,
                limits: limits.limits,
                utilizationAfter,
                warnings: suspiciousCheck.flagged ? 
                    ['Transação monitorada por análise de risco'] : [],
                riskScore: suspiciousCheck.riskScore || 0
            };

        } catch (error) {
            this.logger.error('Error checking transaction limit', {
                userId,
                transactionAmount,
                transactionType,
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: 'Erro interno na verificação de limites',
                code: 'INTERNAL_ERROR'
            };
        }
    }

    /**
     * Atualiza volume de transações do usuário após transação bem-sucedida
     * @param {string} userId - ID do usuário
     * @param {number} transactionAmount - Valor da transação
     * @param {string} transactionType - Tipo da transação
     * @param {Object} metadata - Metadados da transação
     * @returns {Promise<Object>} - Resultado da atualização
     */
    async updateUserTransactionVolume(userId, transactionAmount, transactionType, metadata = {}) {
        try {
            const amount = new BigNumber(transactionAmount);
            const timestamp = new Date().toISOString();

            // Obter volumes atuais
            let userVolumes = this.userTransactionVolumes.get(userId) || {};

            // Atualizar volumes por período
            for (const [periodName, periodConfig] of Object.entries(this.periods)) {
                const periodKey = periodName.toLowerCase();
                
                if (!userVolumes[periodKey]) {
                    userVolumes[periodKey] = {};
                }

                const typeKey = transactionType.toLowerCase();
                if (!userVolumes[periodKey][typeKey]) {
                    userVolumes[periodKey][typeKey] = {
                        volume: new BigNumber(0),
                        count: 0,
                        lastTransaction: null
                    };
                }

                // Limpar volumes expirados
                await this.cleanExpiredVolumes(userVolumes[periodKey], periodConfig.hours);

                // Adicionar nova transação
                userVolumes[periodKey][typeKey].volume = userVolumes[periodKey][typeKey].volume.plus(amount);
                userVolumes[periodKey][typeKey].count++;
                userVolumes[periodKey][typeKey].lastTransaction = timestamp;

                // Adicionar volume total do período
                if (!userVolumes[periodKey].total) {
                    userVolumes[periodKey].total = {
                        volume: new BigNumber(0),
                        count: 0,
                        lastTransaction: null
                    };
                }

                userVolumes[periodKey].total.volume = userVolumes[periodKey].total.volume.plus(amount);
                userVolumes[periodKey].total.count++;
                userVolumes[periodKey].total.lastTransaction = timestamp;
            }

            // Salvar volumes atualizados
            this.userTransactionVolumes.set(userId, userVolumes);

            // Adicionar ao histórico de transações
            let history = this.transactionHistory.get(userId) || [];
            history.unshift({
                amount: amount.toFixed(2),
                type: transactionType,
                timestamp,
                status: 'completed',
                metadata
            });

            // Manter apenas últimas 1000 transações
            if (history.length > 1000) {
                history = history.slice(0, 1000);
            }

            this.transactionHistory.set(userId, history);

            this.logger.info('Transaction volume updated', {
                userId,
                amount: amount.toFixed(2),
                transactionType,
                newDailyVolume: userVolumes.daily?.total?.volume.toFixed(2) || '0'
            });

            return {
                success: true,
                updatedVolumes: {
                    daily: userVolumes.daily?.total?.volume.toFixed(2) || '0',
                    weekly: userVolumes.weekly?.total?.volume.toFixed(2) || '0',
                    monthly: userVolumes.monthly?.total?.volume.toFixed(2) || '0',
                    annual: userVolumes.annual?.total?.volume.toFixed(2) || '0'
                },
                transactionCount: {
                    daily: userVolumes.daily?.total?.count || 0,
                    weekly: userVolumes.weekly?.total?.count || 0,
                    monthly: userVolumes.monthly?.total?.count || 0,
                    annual: userVolumes.annual?.total?.count || 0
                }
            };

        } catch (error) {
            this.logger.error('Error updating transaction volume', {
                userId,
                transactionAmount,
                transactionType,
                error: error.message
            });

            return {
                success: false,
                error: 'Erro ao atualizar volume de transações'
            };
        }
    }

    /**
     * Obtém limites configurados para um nível KYC
     * @param {string} kycLevel - Nível KYC
     * @returns {Object} - Limites configurados
     */
    getKYCLimits(kycLevel) {
        return this.kycService.getKYCLimits(kycLevel);
    }

    /**
     * Obtém volumes de transação atuais do usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Volumes por período
     */
    async getUserTransactionVolumes(userId) {
        const userVolumes = this.userTransactionVolumes.get(userId) || {};
        const result = {};

        for (const [periodName, periodConfig] of Object.entries(this.periods)) {
            const periodKey = periodName.toLowerCase();
            const periodData = userVolumes[periodKey] || {};

            // Limpar volumes expirados
            await this.cleanExpiredVolumes(periodData, periodConfig.hours);

            result[periodKey] = {
                total: periodData.total?.volume || new BigNumber(0),
                count: periodData.total?.count || 0,
                byType: {}
            };

            // Volumes por tipo de transação
            for (const [typeKey, typeData] of Object.entries(periodData)) {
                if (typeKey !== 'total' && typeData.volume) {
                    result[periodKey].byType[typeKey] = {
                        volume: typeData.volume,
                        count: typeData.count
                    };
                }
            }
        }

        return result;
    }

    /**
     * Verifica limites para todos os períodos
     * @param {Object} currentVolumes - Volumes atuais
     * @param {Object} limits - Limites configurados
     * @param {BigNumber} transactionAmount - Valor da transação
     * @param {string} transactionType - Tipo da transação
     * @param {number} riskMultiplier - Multiplicador de risco
     * @returns {Array} - Verificações por período
     */
    async checkAllPeriodLimits(currentVolumes, limits, transactionAmount, transactionType, riskMultiplier) {
        const checks = [];

        for (const [periodName, periodConfig] of Object.entries(this.periods)) {
            const periodKey = periodName.toLowerCase();
            const currentVolume = currentVolumes[periodKey]?.total || new BigNumber(0);
            const limit = new BigNumber(limits.limits[periodKey] * riskMultiplier);
            
            const afterTransactionVolume = currentVolume.plus(transactionAmount);
            const withinLimit = afterTransactionVolume.isLessThanOrEqualTo(limit);
            const remaining = limit.minus(currentVolume);
            const utilization = currentVolume.dividedBy(limit).multipliedBy(100).toFixed(1) + '%';

            checks.push({
                period: periodName,
                currentVolume,
                limit,
                afterTransactionVolume,
                withinLimit,
                remaining: BigNumber.maximum(remaining, 0),
                utilization,
                riskMultiplier
            });
        }

        // Ordenar por mais restritivo primeiro
        return checks.sort((a, b) => {
            if (!a.withinLimit && b.withinLimit) return -1;
            if (a.withinLimit && !b.withinLimit) return 1;
            return a.remaining.comparedTo(b.remaining);
        });
    }

    /**
     * Verifica transação de alto valor
     * @param {string} userId - ID do usuário
     * @param {BigNumber} amount - Valor da transação
     * @param {string} kycLevel - Nível KYC atual
     * @param {Object} metadata - Metadados
     * @returns {Promise<Object>} - Resultado da verificação
     */
    async checkHighValueTransaction(userId, amount, kycLevel, metadata) {
        const threshold = new BigNumber(this.highValueThresholds[kycLevel] || 100);

        if (amount.isLessThan(threshold)) {
            return { approved: true };
        }

        // Transação de alto valor - verificações adicionais
        const checks = [];

        // Verificar histórico do usuário
        const history = this.transactionHistory.get(userId) || [];
        const recentHighValue = history.filter(tx => 
            new BigNumber(tx.amount).isGreaterThanOrEqualTo(threshold) &&
            Date.now() - new Date(tx.timestamp).getTime() < 24 * 60 * 60 * 1000 // 24h
        );

        if (recentHighValue.length >= 3) {
            checks.push('Múltiplas transações de alto valor em 24h');
        }

        // Verificar se é primeira transação de alto valor
        const hasHighValueHistory = history.some(tx => 
            new BigNumber(tx.amount).isGreaterThanOrEqualTo(threshold)
        );

        if (!hasHighValueHistory && kycLevel === 'LEVEL_1') {
            checks.push('Primeira transação de alto valor requer KYC Nível 2');
        }

        // Verificar metadados suspeitos
        if (metadata.ipAddress && this.isHighRiskIP(metadata.ipAddress)) {
            checks.push('Transação de IP de alto risco');
        }

        if (checks.length > 0) {
            return {
                approved: false,
                reason: 'Transação de alto valor requer verificações adicionais',
                details: checks,
                requiredActions: kycLevel === 'LEVEL_1' ? 
                    ['Completar KYC Nível 2 para transações de alto valor'] :
                    ['Aguardar aprovação manual', 'Pode levar até 24 horas']
            };
        }

        return { approved: true };
    }

    /**
     * Verifica padrões de atividade suspeita
     * @param {string} userId - ID do usuário
     * @param {BigNumber} amount - Valor da transação
     * @param {string} transactionType - Tipo da transação
     * @param {Object} metadata - Metadados
     * @returns {Promise<Object>} - Resultado da verificação
     */
    async checkSuspiciousActivity(userId, amount, transactionType, metadata) {
        let riskScore = 0;
        const patterns = [];

        const history = this.transactionHistory.get(userId) || [];
        const recentTransactions = history.filter(tx => 
            Date.now() - new Date(tx.timestamp).getTime() < 60 * 60 * 1000 // 1 hora
        );

        // Padrão 1: Múltiplas transações rápidas
        if (recentTransactions.length >= 5) {
            riskScore += 25;
            patterns.push('Múltiplas transações em curto período');
        }

        // Padrão 2: Valores redondos suspeitos
        if (amount.modulo(1000).isEqualTo(0) && amount.isGreaterThan(5000)) {
            riskScore += 15;
            patterns.push('Valor redondo de alto montante');
        }

        // Padrão 3: Padrão de estruturação (valores abaixo de limites)
        const dailyVolumes = this.userTransactionVolumes.get(userId)?.daily;
        if (dailyVolumes) {
            const limits = this.getKYCLimits(await this.getUserKYCLevel(userId));
            const dailyLimit = new BigNumber(limits.limits.daily);
            
            if (amount.isGreaterThan(dailyLimit.multipliedBy(0.8)) && 
                amount.isLessThan(dailyLimit.multipliedBy(0.95))) {
                riskScore += 20;
                patterns.push('Possível estruturação de transações');
            }
        }

        // Padrão 4: Horário suspeito
        const hour = new Date().getHours();
        if (hour < 6 || hour > 23) {
            riskScore += 10;
            patterns.push('Transação em horário atípico');
        }

        // Padrão 5: Mudança súbita de comportamento
        if (history.length > 0) {
            const avgAmount = history.slice(0, 10).reduce((sum, tx) => 
                sum.plus(new BigNumber(tx.amount)), new BigNumber(0)
            ).dividedBy(Math.min(history.length, 10));

            if (amount.isGreaterThan(avgAmount.multipliedBy(5))) {
                riskScore += 30;
                patterns.push('Valor muito acima do padrão histórico');
            }
        }

        // Registrar atividade suspeita se detectada
        if (riskScore > 30) {
            let suspiciousActivities = this.suspiciousActivity.get(userId) || [];
            suspiciousActivities.unshift({
                patterns,
                riskScore,
                amount: amount.toFixed(2),
                transactionType,
                timestamp: new Date().toISOString(),
                metadata
            });

            // Manter apenas últimas 100 atividades
            if (suspiciousActivities.length > 100) {
                suspiciousActivities = suspiciousActivities.slice(0, 100);
            }

            this.suspiciousActivity.set(userId, suspiciousActivities);
        }

        return {
            flagged: riskScore > 30,
            riskScore,
            patterns
        };
    }

    /**
     * Limpa volumes expirados de um período
     * @param {Object} periodData - Dados do período
     * @param {number} periodHours - Duração do período em horas
     */
    async cleanExpiredVolumes(periodData, periodHours) {
        const cutoffTime = new Date(Date.now() - (periodHours * 60 * 60 * 1000));

        for (const [key, data] of Object.entries(periodData)) {
            if (data.lastTransaction && new Date(data.lastTransaction) < cutoffTime) {
                // Reset volumes expirados
                data.volume = new BigNumber(0);
                data.count = 0;
                data.lastTransaction = null;
            }
        }
    }

    /**
     * Obtém opções de upgrade de KYC
     * @param {string} currentLevel - Nível atual
     * @returns {Object} - Opções de upgrade
     */
    getUpgradeOptions(currentLevel) {
        const nextLevel = this.kycService.getNextAvailableLevel(currentLevel);
        
        if (!nextLevel) {
            return null;
        }

        const nextLimits = this.getKYCLimits(nextLevel);
        
        return {
            nextLevel,
            nextLevelName: nextLimits.name,
            newLimits: nextLimits.limits,
            requirements: nextLimits.requirements,
            estimatedTime: this.getKYCEstimatedTime(nextLevel)
        };
    }

    /**
     * Obtém tempo estimado para completar KYC
     * @param {string} level - Nível KYC
     * @returns {string} - Tempo estimado
     */
    getKYCEstimatedTime(level) {
        const times = {
            'LEVEL_1': '5-10 minutos',
            'LEVEL_2': '10-30 minutos',
            'LEVEL_3': '1-3 dias úteis'
        };

        return times[level] || 'Não disponível';
    }

    /**
     * Obtém nível KYC do usuário (helper)
     * @param {string} userId - ID do usuário
     * @returns {Promise<string>} - Nível KYC
     */
    async getUserKYCLevel(userId) {
        const status = await this.kycService.checkUserKYCStatus(userId);
        return status.success ? status.currentLevel : 'NONE';
    }

    /**
     * Verifica se IP é de alto risco (placeholder)
     * @param {string} ipAddress - Endereço IP
     * @returns {boolean} - Se é alto risco
     */
    isHighRiskIP(ipAddress) {
        // Em produção, consultar base de IPs de alto risco
        const highRiskPatterns = [
            /^10\./, // IPs privados (suspeitos para transações)
            /^192\.168\./, // IPs privados
            /^172\.16\./ // IPs privados
        ];

        return highRiskPatterns.some(pattern => pattern.test(ipAddress));
    }

    /**
     * Obtém estatísticas de limite do usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} - Estatísticas
     */
    async getUserLimitStats(userId) {
        try {
            const kycStatus = await this.kycService.checkUserKYCStatus(userId);
            const volumes = await this.getUserTransactionVolumes(userId);
            const limits = this.getKYCLimits(kycStatus.currentLevel);

            const stats = {
                kycLevel: kycStatus.currentLevel,
                kycStatus: kycStatus.status,
                limits: limits.limits,
                utilization: {},
                transactionCounts: {},
                nextUpgrade: this.getUpgradeOptions(kycStatus.currentLevel)
            };

            // Calcular utilização por período
            for (const [period, volumeData] of Object.entries(volumes)) {
                const limit = new BigNumber(limits.limits[period]);
                const utilized = volumeData.total;
                const percentage = limit.isGreaterThan(0) ? 
                    utilized.dividedBy(limit).multipliedBy(100).toFixed(1) : '0';

                stats.utilization[period] = {
                    used: utilized.toFixed(2),
                    limit: limit.toFixed(2),
                    remaining: BigNumber.maximum(limit.minus(utilized), 0).toFixed(2),
                    percentage: percentage + '%'
                };

                stats.transactionCounts[period] = volumeData.count;
            }

            return {
                success: true,
                data: stats
            };

        } catch (error) {
            this.logger.error('Error getting user limit stats', {
                userId,
                error: error.message
            });

            return {
                success: false,
                error: 'Erro ao obter estatísticas de limite'
            };
        }
    }

    /**
     * Obtém métricas gerais do sistema de limites
     * @returns {Object} - Métricas do sistema
     */
    getLimitMetrics() {
        const metrics = {
            totalUsers: this.userTransactionVolumes.size,
            totalTransactions: 0,
            totalVolume: new BigNumber(0),
            suspiciousActivities: 0,
            limitExceededToday: 0,
            byTransactionType: {}
        };

        // Calcular métricas de transações
        for (const [userId, history] of this.transactionHistory) {
            metrics.totalTransactions += history.length;
            
            for (const tx of history) {
                metrics.totalVolume = metrics.totalVolume.plus(new BigNumber(tx.amount));
                
                if (!metrics.byTransactionType[tx.type]) {
                    metrics.byTransactionType[tx.type] = {
                        count: 0,
                        volume: new BigNumber(0)
                    };
                }
                
                metrics.byTransactionType[tx.type].count++;
                metrics.byTransactionType[tx.type].volume = 
                    metrics.byTransactionType[tx.type].volume.plus(new BigNumber(tx.amount));
            }
        }

        // Contar atividades suspeitas
        for (const [userId, activities] of this.suspiciousActivity) {
            metrics.suspiciousActivities += activities.length;
        }

        // Converter BigNumbers para strings
        metrics.totalVolume = metrics.totalVolume.toFixed(2);
        for (const [type, data] of Object.entries(metrics.byTransactionType)) {
            metrics.byTransactionType[type].volume = data.volume.toFixed(2);
        }

        return metrics;
    }
}

module.exports = LimitService; 