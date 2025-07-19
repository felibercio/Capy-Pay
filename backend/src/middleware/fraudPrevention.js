const FraudDetectionService = require('../services/FraudDetectionService');
const { createLogger, createSpan, finishSpan, addSpanTag, addSpanLog } = require('./observability');

// Instância global do serviço de detecção de fraudes
const fraudDetection = new FraudDetectionService();

/**
 * Middleware para prevenção de fraudes em transações
 * Aplica verificações de blacklist e análise de risco antes de processar transações
 */
const fraudPreventionMiddleware = (transactionType, options = {}) => {
    return async (req, res, next) => {
        const logger = createLogger(req.correlationId, 'fraud-prevention');
        const span = createSpan(`fraud_check_${transactionType}`, req.span);
        
        try {
            const {
                skipForLowRisk = false,
                blockOnMediumRisk = false,
                requireManualReview = true
            } = options;

            // Extrair dados da transação do request
            const transactionData = extractTransactionData(req, transactionType);
            
            addSpanTag(span, 'transaction.type', transactionType);
            addSpanTag(span, 'transaction.amount', transactionData.amount);
            addSpanTag(span, 'user.id', transactionData.userId);

            logger.info('Starting fraud prevention check', {
                transactionType,
                transactionId: transactionData.id,
                userId: transactionData.userId,
                amount: transactionData.amount
            });

            // Executar análise de fraude
            addSpanLog(span, 'Performing fraud analysis');
            const analysis = await fraudDetection.analyzeTransaction(transactionData, req.correlationId);

            // Adicionar resultados ao span
            addSpanTag(span, 'fraud.risk_score', analysis.riskScore);
            addSpanTag(span, 'fraud.risk_level', analysis.riskLevel);
            addSpanTag(span, 'fraud.decision', analysis.decision);

            // Adicionar análise ao request para uso posterior
            req.fraudAnalysis = analysis;

            // Processar decisão
            switch (analysis.decision) {
                case 'BLOCK':
                    logger.warn('Transaction blocked by fraud detection', {
                        transactionId: transactionData.id,
                        userId: transactionData.userId,
                        riskScore: analysis.riskScore,
                        reasons: analysis.reasons
                    });

                    finishSpan(span, 'blocked');

                    return res.status(403).json({
                        success: false,
                        error: 'Transaction blocked due to security concerns',
                        code: 'TRANSACTION_BLOCKED',
                        supportReference: req.correlationId,
                        // Não expor detalhes específicos de segurança
                        message: 'This transaction cannot be processed at this time. Please contact support if you believe this is an error.'
                    });

                case 'REVIEW':
                    if (blockOnMediumRisk) {
                        logger.warn('Transaction blocked (review required)', {
                            transactionId: transactionData.id,
                            userId: transactionData.userId,
                            riskScore: analysis.riskScore
                        });

                        finishSpan(span, 'blocked_for_review');

                        return res.status(403).json({
                            success: false,
                            error: 'Transaction requires manual review',
                            code: 'REVIEW_REQUIRED',
                            supportReference: req.correlationId,
                            message: 'Your transaction is being reviewed for security. This may take up to 24 hours.'
                        });
                    }

                    logger.info('Transaction flagged for review but allowed', {
                        transactionId: transactionData.id,
                        userId: transactionData.userId,
                        riskScore: analysis.riskScore
                    });

                    // Marcar para revisão posterior mas permitir continuar
                    req.requiresReview = true;
                    break;

                case 'ALLOW':
                    if (analysis.riskLevel === 'LOW' && skipForLowRisk) {
                        logger.debug('Low risk transaction - skipping additional checks', {
                            transactionId: transactionData.id,
                            riskScore: analysis.riskScore
                        });
                    }
                    break;
            }

            finishSpan(span, 'allowed');
            
            logger.info('Fraud prevention check completed', {
                transactionId: transactionData.id,
                decision: analysis.decision,
                riskLevel: analysis.riskLevel,
                riskScore: analysis.riskScore
            });

            next();

        } catch (error) {
            logger.error('Error in fraud prevention middleware', {
                error: error.message,
                stack: error.stack,
                transactionType
            });

            finishSpan(span, 'error', error);

            // Em caso de erro, permitir transação mas registrar para investigação
            // (fail-open para não bloquear operações legítimas)
            req.fraudAnalysis = {
                riskScore: 0,
                riskLevel: 'UNKNOWN',
                decision: 'ALLOW',
                error: error.message,
                reasons: ['Fraud analysis failed - transaction allowed by default']
            };

            next();
        }
    };
};

/**
 * Middleware específico para verificação de blacklist apenas
 * Mais rápido que análise completa de fraude
 */
const blacklistCheckMiddleware = (entityTypes = ['user']) => {
    return async (req, res, next) => {
        const logger = createLogger(req.correlationId, 'blacklist-check');
        const span = createSpan('blacklist_verification', req.span);
        
        try {
            const blacklistService = fraudDetection.getBlacklistService();
            const entitiesToCheck = [];

            // Coletar entidades para verificar baseado nos tipos solicitados
            if (entityTypes.includes('user') && req.user?.id) {
                entitiesToCheck.push({
                    type: 'user',
                    value: req.user.id,
                    description: 'User ID'
                });
            }

            if (entityTypes.includes('email') && req.user?.email) {
                entitiesToCheck.push({
                    type: 'email',
                    value: req.user.email,
                    description: 'User email'
                });
            }

            if (entityTypes.includes('ip') && req.ip) {
                entitiesToCheck.push({
                    type: 'ip',
                    value: req.ip,
                    description: 'User IP'
                });
            }

            if (entityTypes.includes('wallet') && req.body.walletAddress) {
                entitiesToCheck.push({
                    type: 'wallet',
                    value: req.body.walletAddress,
                    description: 'Wallet address'
                });
            }

            if (entitiesToCheck.length === 0) {
                addSpanLog(span, 'No entities to check');
                finishSpan(span, 'skipped');
                return next();
            }

            addSpanTag(span, 'entities.count', entitiesToCheck.length);
            addSpanLog(span, 'Checking entities against blacklist');

            // Verificar em lote
            const batchResult = await blacklistService.batchCheck(entitiesToCheck, req.correlationId);

            if (batchResult.success && batchResult.blacklistedEntities.length > 0) {
                // Encontrar a severidade mais alta
                let maxSeverity = 'low';
                const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
                let criticalMatches = [];

                for (const entity of batchResult.results) {
                    if (entity.isBlacklisted) {
                        if (severityOrder[entity.severity] > severityOrder[maxSeverity]) {
                            maxSeverity = entity.severity;
                        }

                        if (entity.severity === 'critical') {
                            criticalMatches.push(entity);
                        }
                    }
                }

                addSpanTag(span, 'blacklist.matches', batchResult.blacklistedEntities.length);
                addSpanTag(span, 'blacklist.max_severity', maxSeverity);

                // Se há matches críticos, bloquear imediatamente
                if (criticalMatches.length > 0) {
                    logger.error('Critical blacklist match detected', {
                        userId: req.user?.id,
                        matches: criticalMatches.map(m => ({
                            type: m.type,
                            reason: m.reason,
                            severity: m.severity
                        })),
                        ip: req.ip
                    });

                    finishSpan(span, 'blocked_critical');

                    return res.status(403).json({
                        success: false,
                        error: 'Access denied',
                        code: 'BLACKLIST_CRITICAL',
                        supportReference: req.correlationId
                    });
                }

                // Para outras severidades, registrar mas permitir
                logger.warn('Blacklist matches found', {
                    userId: req.user?.id,
                    matchCount: batchResult.blacklistedEntities.length,
                    maxSeverity,
                    ip: req.ip
                });

                req.blacklistMatches = batchResult.results.filter(r => r.isBlacklisted);
            }

            finishSpan(span, 'completed');
            next();

        } catch (error) {
            logger.error('Error in blacklist check middleware', {
                error: error.message,
                entityTypes
            });

            finishSpan(span, 'error', error);

            // Permitir continuar em caso de erro
            next();
        }
    };
};

/**
 * Middleware para transações de alto valor
 * Aplica verificações adicionais para transações acima de threshold
 */
const highValueTransactionMiddleware = (threshold = 50000) => {
    return async (req, res, next) => {
        const logger = createLogger(req.correlationId, 'high-value-check');
        
        try {
            const amount = parseFloat(req.body.amount || 0);

            if (amount >= threshold) {
                logger.info('High value transaction detected', {
                    userId: req.user?.id,
                    amount,
                    threshold,
                    transactionType: req.route?.path
                });

                // Verificações adicionais para alto valor
                const additionalChecks = {
                    requiresEnhancedKYC: amount >= 100000,
                    requiresManagerApproval: amount >= 200000,
                    requiresComplianceReview: amount >= 500000
                };

                req.highValueTransaction = {
                    amount,
                    threshold,
                    ...additionalChecks
                };

                // Se requer KYC aprimorado, verificar status
                if (additionalChecks.requiresEnhancedKYC && req.user?.kycLevel !== 'LEVEL_3') {
                    return res.status(403).json({
                        success: false,
                        error: 'Enhanced KYC verification required for this transaction amount',
                        code: 'ENHANCED_KYC_REQUIRED',
                        requiredKycLevel: 'LEVEL_3',
                        currentKycLevel: req.user?.kycLevel || 'NONE'
                    });
                }
            }

            next();

        } catch (error) {
            logger.error('Error in high value transaction middleware', {
                error: error.message,
                amount: req.body.amount
            });

            next();
        }
    };
};

/**
 * Middleware para verificar velocidade de transações
 */
const velocityCheckMiddleware = (limits = {}) => {
    return async (req, res, next) => {
        const logger = createLogger(req.correlationId, 'velocity-check');
        
        try {
            const defaultLimits = {
                transactionsPerHour: 10,
                transactionsPerDay: 50,
                volumePerHour: 10000,
                volumePerDay: 100000
            };

            const effectiveLimits = { ...defaultLimits, ...limits };
            const userId = req.user?.id;

            if (!userId) {
                return next();
            }

            // Obter histórico do usuário (em produção, buscar do banco/cache)
            const userHistory = fraudDetection.getUserHistory?.(userId) || [];
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            const oneDay = 24 * oneHour;

            // Filtrar transações recentes
            const lastHour = userHistory.filter(tx => (now - new Date(tx.timestamp).getTime()) < oneHour);
            const lastDay = userHistory.filter(tx => (now - new Date(tx.timestamp).getTime()) < oneDay);

            const metrics = {
                transactionsLastHour: lastHour.length,
                transactionsLastDay: lastDay.length,
                volumeLastHour: lastHour.reduce((sum, tx) => sum + (tx.amount || 0), 0),
                volumeLastDay: lastDay.reduce((sum, tx) => sum + (tx.amount || 0), 0)
            };

            // Verificar limites
            const violations = [];

            if (metrics.transactionsLastHour >= effectiveLimits.transactionsPerHour) {
                violations.push(`Transaction frequency: ${metrics.transactionsLastHour}/hour (limit: ${effectiveLimits.transactionsPerHour})`);
            }

            if (metrics.transactionsLastDay >= effectiveLimits.transactionsPerDay) {
                violations.push(`Daily transactions: ${metrics.transactionsLastDay}/day (limit: ${effectiveLimits.transactionsPerDay})`);
            }

            if (metrics.volumeLastHour >= effectiveLimits.volumePerHour) {
                violations.push(`Hourly volume: R$ ${metrics.volumeLastHour} (limit: R$ ${effectiveLimits.volumePerHour})`);
            }

            if (metrics.volumeLastDay >= effectiveLimits.volumePerDay) {
                violations.push(`Daily volume: R$ ${metrics.volumeLastDay} (limit: R$ ${effectiveLimits.volumePerDay})`);
            }

            if (violations.length > 0) {
                logger.warn('Velocity limits exceeded', {
                    userId,
                    violations,
                    metrics,
                    limits: effectiveLimits
                });

                return res.status(429).json({
                    success: false,
                    error: 'Transaction velocity limits exceeded',
                    code: 'VELOCITY_LIMIT_EXCEEDED',
                    details: violations,
                    retryAfter: '3600', // 1 hour
                    supportReference: req.correlationId
                });
            }

            req.velocityMetrics = metrics;
            next();

        } catch (error) {
            logger.error('Error in velocity check middleware', {
                error: error.message,
                userId: req.user?.id
            });

            next();
        }
    };
};

/**
 * Extrai dados da transação do request baseado no tipo
 * @param {Object} req - Request object
 * @param {string} transactionType - Tipo da transação
 * @returns {Object} Dados da transação
 */
function extractTransactionData(req, transactionType) {
    const baseData = {
        id: req.body.transactionId || `${transactionType}_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        type: transactionType,
        userId: req.user?.id,
        userEmail: req.user?.email,
        userIP: req.ip,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent')
    };

    // Extrair dados específicos baseado no tipo de transação
    switch (transactionType) {
        case 'crypto_swap':
            return {
                ...baseData,
                amount: parseFloat(req.body.amount || 0),
                fromToken: req.body.fromToken,
                toToken: req.body.toToken,
                fromWallet: req.body.fromWallet || req.user?.walletAddress,
                toWallet: req.body.toWallet,
                slippage: req.body.slippage
            };

        case 'boleto_payment':
            return {
                ...baseData,
                amount: parseFloat(req.body.amount || 0),
                boletoCode: req.body.boletoCode,
                bankAccount: req.body.payerInfo?.bankAccount
            };

        case 'withdrawal':
            return {
                ...baseData,
                amount: parseFloat(req.body.amount || 0),
                toWallet: req.body.destinationAddress,
                fromWallet: req.user?.walletAddress,
                currency: req.body.currency
            };

        case 'deposit':
            return {
                ...baseData,
                amount: parseFloat(req.body.amount || 0),
                fromWallet: req.body.sourceAddress,
                toWallet: req.user?.walletAddress,
                currency: req.body.currency
            };

        case 'pix_transfer':
            return {
                ...baseData,
                amount: parseFloat(req.body.amount || 0),
                pixKey: req.body.pixKey,
                bankAccount: req.body.bankAccount
            };

        default:
            return {
                ...baseData,
                amount: parseFloat(req.body.amount || 0),
                metadata: req.body
            };
    }
}

module.exports = {
    fraudPreventionMiddleware,
    blacklistCheckMiddleware,
    highValueTransactionMiddleware,
    velocityCheckMiddleware,
    fraudDetection // Exportar instância para uso direto
}; 