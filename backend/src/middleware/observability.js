const ObservabilityService = require('../services/ObservabilityService');

// Instância global do serviço de observabilidade
const observability = new ObservabilityService();

/**
 * Middleware de observabilidade para Express
 * Integra logging, métricas e tracing em todas as rotas
 */
const observabilityMiddleware = () => {
    return observability.createTracingMiddleware();
};

/**
 * Middleware para capturar erros e registrar métricas
 */
const errorTrackingMiddleware = (err, req, res, next) => {
    const correlationId = req.correlationId;
    const service = req.route?.path?.split('/')[2] || 'unknown'; // Extrair serviço da rota
    
    // Registrar erro no sistema de observabilidade
    observability.recordError(
        service,
        err.name || 'UnknownError',
        err.status >= 500 ? 'critical' : 'high',
        err,
        correlationId
    );

    // Log estruturado do erro
    const logger = observability.createContextualLogger(correlationId, service);
    logger.error('Request error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.originalUrl,
        statusCode: err.status || 500,
        userAgent: req.get('User-Agent'),
        ip: req.ip
    });

    // Adicionar informações de erro ao span
    if (req.span) {
        observability.tracing.addTag(req.span, 'error', true);
        observability.tracing.addTag(req.span, 'error.message', err.message);
        observability.tracing.addLog(req.span, 'Error occurred', {
            error: err.message,
            stack: err.stack
        });
    }

    next(err);
};

/**
 * Wrapper para registrar operações de transação
 */
const withTransactionTracking = (transactionType) => {
    return (req, res, next) => {
        const originalSend = res.send;
        
        res.send = function(data) {
            try {
                const responseData = typeof data === 'string' ? JSON.parse(data) : data;
                const status = responseData.success ? 'success' : 'failed';
                const amount = responseData.data?.amount || responseData.data?.transactionAmount;
                const userKycLevel = req.user?.kycLevel || 'NONE';

                // Registrar transação
                observability.recordTransaction(transactionType, status, amount, userKycLevel);

                // Log da transação
                const logger = observability.createContextualLogger(req.correlationId, 'transactions');
                logger.info('Transaction processed', {
                    type: transactionType,
                    status,
                    amount,
                    userKycLevel,
                    userId: req.user?.id,
                    duration: Date.now() - req.startTime
                });

            } catch (error) {
                // Se não conseguir parsear resposta, apenas registrar tentativa
                observability.recordTransaction(transactionType, 'unknown', null, 'NONE');
            }

            return originalSend.call(this, data);
        };

        next();
    };
};

/**
 * Wrapper para registrar chamadas de API externa
 */
const withExternalApiTracking = (provider, endpoint) => {
    return async (operation) => {
        return await observability.recordExternalApiCall(provider, endpoint, operation);
    };
};

/**
 * Wrapper para registrar operações blockchain
 */
const withBlockchainTracking = (network, operation) => {
    return (req, res, next) => {
        const originalSend = res.send;
        
        res.send = function(data) {
            try {
                const responseData = typeof data === 'string' ? JSON.parse(data) : data;
                const status = responseData.success ? 'success' : 'failed';

                // Registrar operação blockchain
                observability.recordBlockchainOperation(network, operation, status);

                // Log da operação
                const logger = observability.createContextualLogger(req.correlationId, 'blockchain');
                logger.info('Blockchain operation', {
                    network,
                    operation,
                    status,
                    transactionHash: responseData.data?.transactionHash,
                    gasUsed: responseData.data?.gasUsed,
                    duration: Date.now() - req.startTime
                });

            } catch (error) {
                observability.recordBlockchainOperation(network, operation, 'error');
            }

            return originalSend.call(this, data);
        };

        next();
    };
};

/**
 * Helper para criar logger contextual
 */
const createLogger = (correlationId, service) => {
    return observability.createContextualLogger(correlationId, service);
};

/**
 * Helper para criar span de trace
 */
const createSpan = (operationName, parentSpan = null) => {
    return observability.tracing.createSpan(operationName, parentSpan);
};

/**
 * Helper para finalizar span
 */
const finishSpan = (span, status = 'success', error = null) => {
    return observability.tracing.finishSpan(span, status, error);
};

/**
 * Helper para adicionar tag ao span
 */
const addSpanTag = (span, key, value) => {
    return observability.tracing.addTag(span, key, value);
};

/**
 * Helper para adicionar log ao span
 */
const addSpanLog = (span, message, data = {}) => {
    return observability.tracing.addLog(span, message, data);
};

/**
 * Middleware específico para serviços financeiros
 */
const financialOperationsMiddleware = (operationType) => {
    return (req, res, next) => {
        // Adicionar tags específicas para operações financeiras
        if (req.span) {
            addSpanTag(req.span, 'financial.operation', operationType);
            addSpanTag(req.span, 'financial.user_id', req.user?.id);
            addSpanTag(req.span, 'financial.kyc_level', req.user?.kycLevel);
        }

        // Logger específico para operações financeiras
        req.financialLogger = createLogger(req.correlationId, 'financial');
        
        req.financialLogger.info('Financial operation started', {
            operation: operationType,
            userId: req.user?.id,
            kycLevel: req.user?.kycLevel,
            method: req.method,
            url: req.originalUrl
        });

        next();
    };
};

/**
 * Middleware para monitorar performance de KYC
 */
const kycOperationsMiddleware = (kycLevel) => {
    return (req, res, next) => {
        const originalSend = res.send;
        
        res.send = function(data) {
            try {
                const responseData = typeof data === 'string' ? JSON.parse(data) : data;
                const status = responseData.success ? 'verified' : 'rejected';
                const provider = responseData.data?.provider || 'internal';

                // Registrar verificação KYC
                observability.metrics.kycVerifications
                    .labels(kycLevel, status, provider)
                    .inc();

                // Log da verificação KYC
                const logger = createLogger(req.correlationId, 'kyc');
                logger.info('KYC verification processed', {
                    level: kycLevel,
                    status,
                    provider,
                    userId: req.user?.id,
                    duration: Date.now() - req.startTime,
                    verificationNotes: responseData.data?.verificationNotes
                });

            } catch (error) {
                observability.metrics.kycVerifications
                    .labels(kycLevel, 'error', 'unknown')
                    .inc();
            }

            return originalSend.call(this, data);
        };

        next();
    };
};

/**
 * Middleware para monitorar operações da BRcapy
 */
const brcapyOperationsMiddleware = (operationType) => {
    return (req, res, next) => {
        const originalSend = res.send;
        
        res.send = function(data) {
            try {
                const responseData = typeof data === 'string' ? JSON.parse(data) : data;
                
                if (responseData.success && responseData.data) {
                    // Atualizar métricas da BRcapy
                    if (responseData.data.currentValue) {
                        observability.metrics.brcapyValue.set(parseFloat(responseData.data.currentValue));
                    }
                    
                    if (responseData.data.totalSupply) {
                        observability.metrics.brcapySupply.set(parseFloat(responseData.data.totalSupply));
                    }
                }

                // Log da operação BRcapy
                const logger = createLogger(req.correlationId, 'brcapy');
                logger.info('BRcapy operation processed', {
                    operation: operationType,
                    success: responseData.success,
                    userId: req.user?.id,
                    amount: responseData.data?.amount,
                    newBalance: responseData.data?.newBalance,
                    duration: Date.now() - req.startTime
                });

            } catch (error) {
                // Log de erro na operação BRcapy
                const logger = createLogger(req.correlationId, 'brcapy');
                logger.error('BRcapy operation failed', {
                    operation: operationType,
                    error: error.message,
                    userId: req.user?.id
                });
            }

            return originalSend.call(this, data);
        };

        next();
    };
};

/**
 * Endpoint para métricas do Prometheus
 */
const metricsEndpoint = (req, res) => {
    res.set('Content-Type', observability.metricsRegistry.contentType);
    res.end(observability.getMetrics());
};

/**
 * Endpoint para health check com observabilidade
 */
const healthCheckEndpoint = async (req, res) => {
    try {
        const stats = observability.getSystemStats();
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'capy-pay',
            version: process.env.APP_VERSION || '1.0.0',
            ...stats
        };

        res.json(health);
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

module.exports = {
    // Middleware principal
    observabilityMiddleware,
    errorTrackingMiddleware,
    
    // Middleware específicos
    withTransactionTracking,
    withExternalApiTracking,
    withBlockchainTracking,
    financialOperationsMiddleware,
    kycOperationsMiddleware,
    brcapyOperationsMiddleware,
    
    // Helpers
    createLogger,
    createSpan,
    finishSpan,
    addSpanTag,
    addSpanLog,
    
    // Endpoints
    metricsEndpoint,
    healthCheckEndpoint,
    
    // Instância do serviço
    observability
}; 