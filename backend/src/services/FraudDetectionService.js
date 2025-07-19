const BlacklistService = require('./BlacklistService');
const { createLogger } = require('../middleware/observability');

/**
 * FraudDetectionService - Sistema completo de detecção e prevenção de fraudes
 * 
 * Funcionalidades:
 * - Integração com BlacklistService
 * - Análise de risco em tempo real
 * - Detecção de padrões suspeitos
 * - Machine Learning básico para scoring
 * - Integração com fluxos de transação
 * - Alertas automáticos para equipe de segurança
 * - Gestão de casos de investigação
 * 
 * Tipos de Análises:
 * - Verificação de blacklist
 * - Análise comportamental
 * - Detecção de velocidade anômala
 * - Verificação de geolocalização
 * - Análise de valor de transação
 * - Detecção de padrões de lavagem
 */
class FraudDetectionService {
    constructor() {
        this.blacklistService = new BlacklistService();
        this.logger = createLogger('fraud_detection_service', 'fraud-detection');
        
        // Cache de análises recentes
        this.analysisCache = new Map();
        this.cacheExpiry = 2 * 60 * 1000; // 2 minutos
        
        // Histórico de transações por usuário (em produção usar Redis/DB)
        this.userTransactionHistory = new Map();
        
        // Casos de investigação ativos
        this.activeCases = new Map();
        
        // Configurações de risco
        this.riskConfig = {
            // Thresholds de risco
            riskThresholds: {
                LOW: { min: 0, max: 30 },
                MEDIUM: { min: 30, max: 60 },
                HIGH: { min: 60, max: 85 },
                CRITICAL: { min: 85, max: 100 }
            },
            
            // Pesos para cálculo de risco
            riskWeights: {
                blacklist: 50,          // 50% do score se blacklistado
                velocity: 20,           // 20% baseado em velocidade
                amount: 15,             // 15% baseado em valor
                geolocation: 10,        // 10% baseado em localização
                behavioral: 5           // 5% baseado em comportamento
            },
            
            // Limites de velocidade
            velocityLimits: {
                transactions_per_hour: 10,
                transactions_per_day: 50,
                volume_per_hour: 10000,    // BRL
                volume_per_day: 100000     // BRL
            },
            
            // Limites de valor
            amountLimits: {
                single_transaction_alert: 50000,  // BRL
                daily_volume_alert: 200000,       // BRL
                unusual_amount_threshold: 0.8     // 80% acima da média
            },
            
            // Padrões suspeitos
            suspiciousPatterns: {
                round_amounts: true,           // Valores redondos (10000, 50000)
                rapid_succession: true,        // Transações em sequência rápida
                same_amount_repeated: true,    // Mesmo valor repetido
                structuring: true,             // Fracionamento de valores
                unusual_hours: true           // Transações em horários incomuns
            }
        };

        // Estatísticas
        this.stats = {
            totalAnalyses: 0,
            blockedTransactions: 0,
            flaggedUsers: 0,
            activeCasesCount: 0,
            lastReset: new Date().toISOString()
        };

        this.logger.info('FraudDetectionService initialized', {
            riskThresholds: Object.keys(this.riskConfig.riskThresholds),
            riskWeights: this.riskConfig.riskWeights,
            velocityLimits: this.riskConfig.velocityLimits
        });
    }

    /**
     * Análise completa de risco para transação
     * @param {Object} transactionData - Dados da transação
     * @param {string} correlationId - ID de correlação
     * @returns {Object} Resultado da análise
     */
    async analyzeTransaction(transactionData, correlationId = null) {
        try {
            const analysisStart = Date.now();
            this.stats.totalAnalyses++;

            this.logger.info('Starting fraud analysis', {
                transactionId: transactionData.id,
                userId: transactionData.userId,
                type: transactionData.type,
                amount: transactionData.amount,
                correlationId
            });

            // Estrutura de resposta padrão
            const analysis = {
                transactionId: transactionData.id,
                userId: transactionData.userId,
                riskScore: 0,
                riskLevel: 'LOW',
                decision: 'ALLOW', // ALLOW, REVIEW, BLOCK
                reasons: [],
                checks: {
                    blacklist: null,
                    velocity: null,
                    amount: null,
                    geolocation: null,
                    behavioral: null,
                    patterns: null
                },
                recommendations: [],
                timestamp: new Date().toISOString(),
                analysisTime: 0,
                correlationId
            };

            // 1. Verificação de Blacklist (mais crítica)
            analysis.checks.blacklist = await this.checkBlacklist(transactionData, correlationId);
            if (analysis.checks.blacklist.risk > 0) {
                analysis.riskScore += analysis.checks.blacklist.risk;
                analysis.reasons.push(...analysis.checks.blacklist.reasons);
            }

            // Se blacklistado com severidade crítica, bloquear imediatamente
            if (analysis.checks.blacklist.severity === 'critical') {
                analysis.decision = 'BLOCK';
                analysis.riskLevel = 'CRITICAL';
                analysis.riskScore = 100;
                analysis.recommendations.push('Immediate block due to critical blacklist match');
                
                this.stats.blockedTransactions++;
                this.createInvestigationCase(transactionData, analysis, 'BLACKLIST_CRITICAL');
                
                return this.finalizeAnalysis(analysis, analysisStart);
            }

            // 2. Análise de Velocidade
            analysis.checks.velocity = await this.checkVelocity(transactionData);
            if (analysis.checks.velocity.risk > 0) {
                analysis.riskScore += analysis.checks.velocity.risk;
                analysis.reasons.push(...analysis.checks.velocity.reasons);
            }

            // 3. Análise de Valor
            analysis.checks.amount = await this.checkAmount(transactionData);
            if (analysis.checks.amount.risk > 0) {
                analysis.riskScore += analysis.checks.amount.risk;
                analysis.reasons.push(...analysis.checks.amount.reasons);
            }

            // 4. Análise de Geolocalização
            analysis.checks.geolocation = await this.checkGeolocation(transactionData);
            if (analysis.checks.geolocation.risk > 0) {
                analysis.riskScore += analysis.checks.geolocation.risk;
                analysis.reasons.push(...analysis.checks.geolocation.reasons);
            }

            // 5. Análise Comportamental
            analysis.checks.behavioral = await this.checkBehavioral(transactionData);
            if (analysis.checks.behavioral.risk > 0) {
                analysis.riskScore += analysis.checks.behavioral.risk;
                analysis.reasons.push(...analysis.checks.behavioral.reasons);
            }

            // 6. Detecção de Padrões Suspeitos
            analysis.checks.patterns = await this.checkSuspiciousPatterns(transactionData);
            if (analysis.checks.patterns.risk > 0) {
                analysis.riskScore += analysis.checks.patterns.risk;
                analysis.reasons.push(...analysis.checks.patterns.reasons);
            }

            // Determinar nível de risco e decisão
            analysis.riskLevel = this.calculateRiskLevel(analysis.riskScore);
            analysis.decision = this.makeDecision(analysis.riskScore, analysis.checks);

            // Gerar recomendações
            analysis.recommendations = this.generateRecommendations(analysis);

            // Atualizar histórico do usuário
            this.updateUserHistory(transactionData, analysis);

            // Criar caso de investigação se necessário
            if (analysis.decision === 'REVIEW' || analysis.riskLevel === 'HIGH') {
                this.createInvestigationCase(transactionData, analysis, 'RISK_REVIEW');
                this.stats.flaggedUsers++;
            }

            // Bloquear se decisão for BLOCK
            if (analysis.decision === 'BLOCK') {
                this.stats.blockedTransactions++;
            }

            this.logger.info('Fraud analysis completed', {
                transactionId: transactionData.id,
                riskScore: analysis.riskScore,
                riskLevel: analysis.riskLevel,
                decision: analysis.decision,
                analysisTime: Date.now() - analysisStart,
                correlationId
            });

            return this.finalizeAnalysis(analysis, analysisStart);

        } catch (error) {
            this.logger.error('Error in fraud analysis', {
                error: error.message,
                stack: error.stack,
                transactionId: transactionData.id,
                correlationId
            });

            // Em caso de erro, permitir transação mas registrar para investigação
            return {
                transactionId: transactionData.id,
                userId: transactionData.userId,
                riskScore: 0,
                riskLevel: 'UNKNOWN',
                decision: 'ALLOW',
                reasons: ['Analysis failed - allowing by default'],
                error: error.message,
                timestamp: new Date().toISOString(),
                correlationId
            };
        }
    }

    /**
     * Verificação de blacklist para transação
     * @param {Object} transactionData - Dados da transação
     * @param {string} correlationId - ID de correlação
     * @returns {Object} Resultado da verificação
     */
    async checkBlacklist(transactionData, correlationId) {
        const result = {
            risk: 0,
            reasons: [],
            severity: null,
            details: []
        };

        try {
            // Entidades para verificar
            const entitiesToCheck = [];

            // Usuário
            if (transactionData.userId) {
                entitiesToCheck.push({
                    type: 'user',
                    value: transactionData.userId,
                    description: 'User ID'
                });
            }

            // Email do usuário
            if (transactionData.userEmail) {
                entitiesToCheck.push({
                    type: 'email',
                    value: transactionData.userEmail,
                    description: 'User email'
                });
            }

            // Endereços de carteira
            if (transactionData.fromWallet) {
                entitiesToCheck.push({
                    type: 'wallet',
                    value: transactionData.fromWallet,
                    description: 'Source wallet'
                });
            }

            if (transactionData.toWallet) {
                entitiesToCheck.push({
                    type: 'wallet',
                    value: transactionData.toWallet,
                    description: 'Destination wallet'
                });
            }

            // IP do usuário
            if (transactionData.userIP) {
                entitiesToCheck.push({
                    type: 'ip',
                    value: transactionData.userIP,
                    description: 'User IP address'
                });
            }

            // Conta bancária (para saques/depósitos)
            if (transactionData.bankAccount) {
                entitiesToCheck.push({
                    type: 'bank_account',
                    value: transactionData.bankAccount,
                    description: 'Bank account'
                });
            }

            // Verificar cada entidade
            const batchResult = await this.blacklistService.batchCheck(entitiesToCheck, correlationId);

            if (batchResult.success && batchResult.blacklistedEntities.length > 0) {
                // Calcular risco baseado na severidade mais alta encontrada
                let maxSeverity = 'low';
                const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };

                for (const entity of batchResult.results) {
                    if (entity.isBlacklisted) {
                        result.details.push({
                            type: entity.type,
                            value: entity.value,
                            reason: entity.reason,
                            severity: entity.severity,
                            source: entity.source
                        });

                        result.reasons.push(`${entity.description} is blacklisted: ${entity.reason}`);

                        // Atualizar severidade máxima
                        if (severityOrder[entity.severity] > severityOrder[maxSeverity]) {
                            maxSeverity = entity.severity;
                        }
                    }
                }

                result.severity = maxSeverity;

                // Calcular risco baseado na severidade
                const riskBySevertiy = {
                    low: 10,
                    medium: 30,
                    high: 60,
                    critical: 100
                };

                result.risk = riskBySevertiy[maxSeverity] || 0;

                this.logger.warn('Blacklist matches found', {
                    transactionId: transactionData.id,
                    matchCount: batchResult.blacklistedEntities.length,
                    maxSeverity,
                    risk: result.risk,
                    correlationId
                });
            }

        } catch (error) {
            this.logger.error('Error checking blacklist', {
                error: error.message,
                transactionId: transactionData.id,
                correlationId
            });
        }

        return result;
    }

    /**
     * Análise de velocidade de transações
     * @param {Object} transactionData - Dados da transação
     * @returns {Object} Resultado da análise
     */
    async checkVelocity(transactionData) {
        const result = {
            risk: 0,
            reasons: [],
            details: {}
        };

        try {
            const userId = transactionData.userId;
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            const oneDay = 24 * oneHour;

            // Obter histórico do usuário
            const userHistory = this.getUserHistory(userId);
            
            // Filtrar transações da última hora e dia
            const lastHour = userHistory.filter(tx => (now - new Date(tx.timestamp).getTime()) < oneHour);
            const lastDay = userHistory.filter(tx => (now - new Date(tx.timestamp).getTime()) < oneDay);

            // Calcular métricas
            const metrics = {
                transactionsLastHour: lastHour.length,
                transactionsLastDay: lastDay.length,
                volumeLastHour: lastHour.reduce((sum, tx) => sum + (tx.amount || 0), 0),
                volumeLastDay: lastDay.reduce((sum, tx) => sum + (tx.amount || 0), 0)
            };

            result.details = metrics;

            // Verificar limites de velocidade
            const limits = this.riskConfig.velocityLimits;
            let riskPoints = 0;

            if (metrics.transactionsLastHour > limits.transactions_per_hour) {
                const excess = metrics.transactionsLastHour - limits.transactions_per_hour;
                riskPoints += Math.min(excess * 2, 20); // Máximo 20 pontos
                result.reasons.push(`Excessive transactions per hour: ${metrics.transactionsLastHour}`);
            }

            if (metrics.transactionsLastDay > limits.transactions_per_day) {
                const excess = metrics.transactionsLastDay - limits.transactions_per_day;
                riskPoints += Math.min(excess * 0.5, 10); // Máximo 10 pontos
                result.reasons.push(`Excessive transactions per day: ${metrics.transactionsLastDay}`);
            }

            if (metrics.volumeLastHour > limits.volume_per_hour) {
                const excessRatio = metrics.volumeLastHour / limits.volume_per_hour;
                riskPoints += Math.min(excessRatio * 5, 15); // Máximo 15 pontos
                result.reasons.push(`Excessive volume per hour: R$ ${metrics.volumeLastHour.toFixed(2)}`);
            }

            if (metrics.volumeLastDay > limits.volume_per_day) {
                const excessRatio = metrics.volumeLastDay / limits.volume_per_day;
                riskPoints += Math.min(excessRatio * 3, 10); // Máximo 10 pontos
                result.reasons.push(`Excessive volume per day: R$ ${metrics.volumeLastDay.toFixed(2)}`);
            }

            result.risk = Math.min(riskPoints, this.riskConfig.riskWeights.velocity);

        } catch (error) {
            this.logger.error('Error checking velocity', {
                error: error.message,
                transactionId: transactionData.id
            });
        }

        return result;
    }

    /**
     * Análise de valor da transação
     * @param {Object} transactionData - Dados da transação
     * @returns {Object} Resultado da análise
     */
    async checkAmount(transactionData) {
        const result = {
            risk: 0,
            reasons: [],
            details: {}
        };

        try {
            const amount = parseFloat(transactionData.amount || 0);
            const limits = this.riskConfig.amountLimits;

            // Obter histórico do usuário para calcular média
            const userHistory = this.getUserHistory(transactionData.userId);
            const avgAmount = userHistory.length > 0 
                ? userHistory.reduce((sum, tx) => sum + (tx.amount || 0), 0) / userHistory.length
                : 0;

            result.details = {
                amount,
                averageAmount: avgAmount,
                isUnusual: false,
                isHighValue: false
            };

            let riskPoints = 0;

            // Verificar valor alto
            if (amount > limits.single_transaction_alert) {
                const ratio = amount / limits.single_transaction_alert;
                riskPoints += Math.min(ratio * 5, 10);
                result.reasons.push(`High value transaction: R$ ${amount.toFixed(2)}`);
                result.details.isHighValue = true;
            }

            // Verificar valor incomum (muito acima da média do usuário)
            if (avgAmount > 0 && amount > avgAmount * (1 + limits.unusual_amount_threshold)) {
                const ratio = amount / avgAmount;
                riskPoints += Math.min(ratio * 2, 8);
                result.reasons.push(`Unusual amount for user: ${ratio.toFixed(1)}x above average`);
                result.details.isUnusual = true;
            }

            // Verificar valores redondos suspeitos (possível estruturação)
            if (this.isRoundAmount(amount)) {
                riskPoints += 2;
                result.reasons.push('Round amount potentially suspicious');
            }

            result.risk = Math.min(riskPoints, this.riskConfig.riskWeights.amount);

        } catch (error) {
            this.logger.error('Error checking amount', {
                error: error.message,
                transactionId: transactionData.id
            });
        }

        return result;
    }

    /**
     * Análise de geolocalização
     * @param {Object} transactionData - Dados da transação
     * @returns {Object} Resultado da análise
     */
    async checkGeolocation(transactionData) {
        const result = {
            risk: 0,
            reasons: [],
            details: {}
        };

        try {
            // Para MVP, análise básica baseada em IP
            const userIP = transactionData.userIP;
            const userHistory = this.getUserHistory(transactionData.userId);
            
            if (!userIP) {
                return result;
            }

            // Simular detecção de país/região (em produção usar serviço de geolocalização)
            const currentLocation = this.getLocationFromIP(userIP);
            
            // Obter localizações históricas do usuário
            const historicalLocations = userHistory
                .filter(tx => tx.userIP)
                .map(tx => this.getLocationFromIP(tx.userIP))
                .filter(loc => loc.country);

            result.details = {
                currentLocation,
                historicalLocations: [...new Set(historicalLocations.map(loc => loc.country))],
                isNewLocation: false,
                isSuspiciousLocation: false
            };

            let riskPoints = 0;

            // Verificar se é uma localização nova
            const knownCountries = new Set(historicalLocations.map(loc => loc.country));
            if (currentLocation.country && !knownCountries.has(currentLocation.country)) {
                riskPoints += 5;
                result.reasons.push(`Transaction from new country: ${currentLocation.country}`);
                result.details.isNewLocation = true;
            }

            // Verificar países de alto risco (lista simplificada)
            const highRiskCountries = ['Unknown', 'TOR', 'VPN'];
            if (highRiskCountries.includes(currentLocation.country)) {
                riskPoints += 8;
                result.reasons.push(`Transaction from high-risk location: ${currentLocation.country}`);
                result.details.isSuspiciousLocation = true;
            }

            result.risk = Math.min(riskPoints, this.riskConfig.riskWeights.geolocation);

        } catch (error) {
            this.logger.error('Error checking geolocation', {
                error: error.message,
                transactionId: transactionData.id
            });
        }

        return result;
    }

    /**
     * Análise comportamental
     * @param {Object} transactionData - Dados da transação
     * @returns {Object} Resultado da análise
     */
    async checkBehavioral(transactionData) {
        const result = {
            risk: 0,
            reasons: [],
            details: {}
        };

        try {
            const userHistory = this.getUserHistory(transactionData.userId);
            const currentHour = new Date().getHours();
            
            if (userHistory.length === 0) {
                return result;
            }

            // Analisar padrões de horário
            const hourlyPattern = userHistory.reduce((acc, tx) => {
                const hour = new Date(tx.timestamp).getHours();
                acc[hour] = (acc[hour] || 0) + 1;
                return acc;
            }, {});

            // Verificar se transação está em horário incomum para o usuário
            const transactionsAtCurrentHour = hourlyPattern[currentHour] || 0;
            const totalTransactions = userHistory.length;
            const normalizedFrequency = transactionsAtCurrentHour / totalTransactions;

            result.details = {
                currentHour,
                transactionsAtThisHour: transactionsAtCurrentHour,
                normalizedFrequency,
                isUnusualHour: false
            };

            let riskPoints = 0;

            // Se frequência muito baixa no horário atual (< 5%) e é horário suspeito
            if (normalizedFrequency < 0.05 && (currentHour < 6 || currentHour > 23)) {
                riskPoints += 3;
                result.reasons.push(`Unusual transaction hour: ${currentHour}:00`);
                result.details.isUnusualHour = true;
            }

            result.risk = Math.min(riskPoints, this.riskConfig.riskWeights.behavioral);

        } catch (error) {
            this.logger.error('Error checking behavioral patterns', {
                error: error.message,
                transactionId: transactionData.id
            });
        }

        return result;
    }

    /**
     * Detecção de padrões suspeitos
     * @param {Object} transactionData - Dados da transação
     * @returns {Object} Resultado da análise
     */
    async checkSuspiciousPatterns(transactionData) {
        const result = {
            risk: 0,
            reasons: [],
            details: {}
        };

        try {
            const amount = parseFloat(transactionData.amount || 0);
            const userHistory = this.getUserHistory(transactionData.userId);
            
            result.details = {
                patterns: []
            };

            let riskPoints = 0;

            // 1. Valores redondos frequentes
            if (this.isRoundAmount(amount)) {
                const recentRoundAmounts = userHistory
                    .filter(tx => Date.now() - new Date(tx.timestamp).getTime() < 24 * 60 * 60 * 1000)
                    .filter(tx => this.isRoundAmount(tx.amount || 0));

                if (recentRoundAmounts.length >= 3) {
                    riskPoints += 4;
                    result.reasons.push('Pattern: Frequent round amounts');
                    result.details.patterns.push('frequent_round_amounts');
                }
            }

            // 2. Mesmo valor repetido
            const sameAmountCount = userHistory
                .filter(tx => Math.abs((tx.amount || 0) - amount) < 0.01)
                .length;

            if (sameAmountCount >= 3) {
                riskPoints += 3;
                result.reasons.push(`Pattern: Same amount repeated ${sameAmountCount} times`);
                result.details.patterns.push('repeated_amounts');
            }

            // 3. Transações em sequência rápida
            const now = Date.now();
            const recentTransactions = userHistory
                .filter(tx => (now - new Date(tx.timestamp).getTime()) < 5 * 60 * 1000); // 5 minutos

            if (recentTransactions.length >= 3) {
                riskPoints += 5;
                result.reasons.push('Pattern: Rapid succession transactions');
                result.details.patterns.push('rapid_succession');
            }

            // 4. Possível estruturação (fracionamento)
            const dailyTransactions = userHistory
                .filter(tx => (now - new Date(tx.timestamp).getTime()) < 24 * 60 * 60 * 1000);

            const totalDailyVolume = dailyTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
            
            if (dailyTransactions.length >= 5 && totalDailyVolume > 50000) {
                const avgTransaction = totalDailyVolume / dailyTransactions.length;
                if (avgTransaction < 10000 && totalDailyVolume > 50000) {
                    riskPoints += 8;
                    result.reasons.push('Pattern: Possible structuring (breaking large amounts)');
                    result.details.patterns.push('possible_structuring');
                }
            }

            result.risk = Math.min(riskPoints, 15); // Máximo 15 pontos para padrões

        } catch (error) {
            this.logger.error('Error checking suspicious patterns', {
                error: error.message,
                transactionId: transactionData.id
            });
        }

        return result;
    }

    /**
     * Calcula nível de risco baseado no score
     * @param {number} riskScore - Score de risco
     * @returns {string} Nível de risco
     */
    calculateRiskLevel(riskScore) {
        const thresholds = this.riskConfig.riskThresholds;
        
        if (riskScore >= thresholds.CRITICAL.min) return 'CRITICAL';
        if (riskScore >= thresholds.HIGH.min) return 'HIGH';
        if (riskScore >= thresholds.MEDIUM.min) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Toma decisão baseada no risco
     * @param {number} riskScore - Score de risco
     * @param {Object} checks - Resultados das verificações
     * @returns {string} Decisão
     */
    makeDecision(riskScore, checks) {
        // Blacklist crítica sempre bloqueia
        if (checks.blacklist && checks.blacklist.severity === 'critical') {
            return 'BLOCK';
        }

        // Score alto bloqueia
        if (riskScore >= this.riskConfig.riskThresholds.CRITICAL.min) {
            return 'BLOCK';
        }

        // Score médio-alto vai para revisão
        if (riskScore >= this.riskConfig.riskThresholds.HIGH.min) {
            return 'REVIEW';
        }

        // Score médio pode ir para revisão dependendo dos checks
        if (riskScore >= this.riskConfig.riskThresholds.MEDIUM.min) {
            // Se há múltiplas flags, enviar para revisão
            const flaggedChecks = Object.values(checks).filter(check => check && check.risk > 0).length;
            if (flaggedChecks >= 3) {
                return 'REVIEW';
            }
        }

        return 'ALLOW';
    }

    /**
     * Gera recomendações baseadas na análise
     * @param {Object} analysis - Resultado da análise
     * @returns {Array} Lista de recomendações
     */
    generateRecommendations(analysis) {
        const recommendations = [];

        if (analysis.decision === 'BLOCK') {
            recommendations.push('Transaction blocked due to high risk');
            recommendations.push('Contact security team immediately');
        }

        if (analysis.decision === 'REVIEW') {
            recommendations.push('Manual review required');
            recommendations.push('Verify user identity and transaction purpose');
        }

        if (analysis.checks.blacklist && analysis.checks.blacklist.risk > 0) {
            recommendations.push('Investigate blacklist matches');
            recommendations.push('Consider updating user risk profile');
        }

        if (analysis.checks.velocity && analysis.checks.velocity.risk > 0) {
            recommendations.push('Monitor user transaction velocity');
            recommendations.push('Consider temporary limits');
        }

        if (analysis.checks.patterns && analysis.checks.patterns.details.patterns.length > 0) {
            recommendations.push('Investigate suspicious transaction patterns');
            recommendations.push('Review for potential money laundering');
        }

        return recommendations;
    }

    /**
     * Obtém histórico de transações do usuário
     * @param {string} userId - ID do usuário
     * @returns {Array} Histórico de transações
     */
    getUserHistory(userId) {
        return this.userTransactionHistory.get(userId) || [];
    }

    /**
     * Atualiza histórico do usuário
     * @param {Object} transactionData - Dados da transação
     * @param {Object} analysis - Resultado da análise
     */
    updateUserHistory(transactionData, analysis) {
        const userId = transactionData.userId;
        const history = this.getUserHistory(userId);

        const entry = {
            transactionId: transactionData.id,
            type: transactionData.type,
            amount: transactionData.amount,
            timestamp: new Date().toISOString(),
            riskScore: analysis.riskScore,
            riskLevel: analysis.riskLevel,
            decision: analysis.decision,
            userIP: transactionData.userIP
        };

        history.push(entry);

        // Manter apenas últimas 1000 transações por usuário
        if (history.length > 1000) {
            history.splice(0, history.length - 500);
        }

        this.userTransactionHistory.set(userId, history);
    }

    /**
     * Cria caso de investigação
     * @param {Object} transactionData - Dados da transação
     * @param {Object} analysis - Resultado da análise
     * @param {string} caseType - Tipo do caso
     */
    createInvestigationCase(transactionData, analysis, caseType) {
        const caseId = `case_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        const investigationCase = {
            id: caseId,
            type: caseType,
            status: 'OPEN',
            priority: analysis.riskLevel,
            userId: transactionData.userId,
            transactionId: transactionData.id,
            riskScore: analysis.riskScore,
            reasons: analysis.reasons,
            createdAt: new Date().toISOString(),
            assignedTo: null,
            notes: [],
            evidence: {
                transactionData,
                analysis,
                userHistory: this.getUserHistory(transactionData.userId).slice(-10) // Últimas 10
            }
        };

        this.activeCases.set(caseId, investigationCase);
        this.stats.activeCasesCount++;

        this.logger.warn('Investigation case created', {
            caseId,
            type: caseType,
            priority: analysis.riskLevel,
            userId: transactionData.userId,
            transactionId: transactionData.id
        });

        return caseId;
    }

    /**
     * Verifica se valor é redondo (suspeito)
     * @param {number} amount - Valor a verificar
     * @returns {boolean} Se é valor redondo
     */
    isRoundAmount(amount) {
        // Valores terminados em 000 ou múltiplos exatos de 100/500/1000
        return amount % 1000 === 0 || amount % 500 === 0 || amount % 100 === 0;
    }

    /**
     * Simula obtenção de localização por IP
     * @param {string} ip - Endereço IP
     * @returns {Object} Localização simulada
     */
    getLocationFromIP(ip) {
        // Simulação para MVP - em produção usar MaxMind, IPinfo, etc.
        const locations = {
            '192.168.': { country: 'Brazil', region: 'Local' },
            '10.': { country: 'Brazil', region: 'Local' },
            '127.': { country: 'Brazil', region: 'Local' }
        };

        for (const prefix of Object.keys(locations)) {
            if (ip.startsWith(prefix)) {
                return locations[prefix];
            }
        }

        // Simulação de países baseada no último octeto
        const lastOctet = parseInt(ip.split('.').pop() || '0');
        const countries = ['Brazil', 'USA', 'Argentina', 'Unknown', 'TOR'];
        
        return {
            country: countries[lastOctet % countries.length],
            region: 'Unknown'
        };
    }

    /**
     * Finaliza análise calculando tempo
     * @param {Object} analysis - Análise
     * @param {number} startTime - Tempo de início
     * @returns {Object} Análise finalizada
     */
    finalizeAnalysis(analysis, startTime) {
        analysis.analysisTime = Date.now() - startTime;
        return analysis;
    }

    /**
     * Obtém estatísticas do serviço
     * @returns {Object} Estatísticas
     */
    getStatistics() {
        return {
            ...this.stats,
            blacklistStats: this.blacklistService.getStatistics(),
            cacheSize: this.analysisCache.size,
            userHistorySize: this.userTransactionHistory.size,
            activeCasesCount: this.activeCases.size
        };
    }

    /**
     * Obtém casos de investigação
     * @param {Object} filters - Filtros
     * @returns {Object} Casos de investigação
     */
    getInvestigationCases(filters = {}) {
        let cases = Array.from(this.activeCases.values());

        if (filters.status) {
            cases = cases.filter(c => c.status === filters.status);
        }

        if (filters.priority) {
            cases = cases.filter(c => c.priority === filters.priority);
        }

        if (filters.type) {
            cases = cases.filter(c => c.type === filters.type);
        }

        return {
            success: true,
            cases: cases.slice(0, filters.limit || 50),
            total: cases.length
        };
    }

    /**
     * Atualiza caso de investigação
     * @param {string} caseId - ID do caso
     * @param {Object} updates - Atualizações
     * @returns {Object} Resultado
     */
    updateInvestigationCase(caseId, updates) {
        const case_ = this.activeCases.get(caseId);
        
        if (!case_) {
            return {
                success: false,
                error: 'Case not found'
            };
        }

        Object.assign(case_, updates);
        case_.updatedAt = new Date().toISOString();

        if (updates.status === 'CLOSED') {
            this.stats.activeCasesCount--;
        }

        this.logger.info('Investigation case updated', {
            caseId,
            updates: Object.keys(updates)
        });

        return {
            success: true,
            case: case_
        };
    }

    // Expor BlacklistService para uso direto
    getBlacklistService() {
        return this.blacklistService;
    }
}

module.exports = FraudDetectionService; 