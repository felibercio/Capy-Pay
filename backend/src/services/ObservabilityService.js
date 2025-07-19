const winston = require('winston');
const prometheus = require('prom-client');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

/**
 * ObservabilityService - Sistema completo de observabilidade para Capy Pay
 * 
 * Funcionalidades:
 * - Logging estruturado e centralizado
 * - Coleta de métricas de negócio e sistema
 * - Rastreamento distribuído com correlationId
 * - Alertas automáticos para eventos críticos
 * - Integração com ferramentas de monitoramento
 * 
 * Pilares da Observabilidade:
 * 1. LOGS: O que aconteceu e quando
 * 2. MÉTRICAS: Quantos, quão rápido, quão grande
 * 3. TRACES: Como os componentes interagem
 * 4. ALERTAS: Quando algo precisa de atenção
 */
class ObservabilityService {
    constructor() {
        // Inicializar sistema de logging
        this.initializeLogging();
        
        // Inicializar coleta de métricas
        this.initializeMetrics();
        
        // Configurar rastreamento distribuído
        this.initializeTracing();
        
        // Configurar sistema de alertas
        this.initializeAlerting();
        
        // Armazenar traces ativos
        this.activeTraces = new Map();
        
        // Configurações de observabilidade
        this.config = {
            serviceName: 'capy-pay',
            environment: process.env.NODE_ENV || 'development',
            version: process.env.APP_VERSION || '1.0.0',
            
            // Configurações de logging
            logging: {
                level: process.env.LOG_LEVEL || 'info',
                format: 'json',
                destinations: ['console', 'file', 'cloud'],
                retention: '30d'
            },
            
            // Configurações de métricas
            metrics: {
                collectInterval: 15000, // 15 segundos
                defaultLabels: {
                    service: 'capy-pay',
                    environment: process.env.NODE_ENV || 'development'
                }
            },
            
            // Configurações de alertas
            alerting: {
                channels: {
                    slack: process.env.SLACK_WEBHOOK_URL,
                    email: process.env.ALERT_EMAIL,
                    pagerduty: process.env.PAGERDUTY_KEY
                },
                thresholds: {
                    errorRate: 0.05,        // 5% taxa de erro
                    responseTime: 5000,     // 5s tempo de resposta
                    cpuUsage: 80,          // 80% CPU
                    memoryUsage: 85,       // 85% memória
                    diskUsage: 90          // 90% disco
                }
            }
        };

        this.logger.info('ObservabilityService initialized', {
            serviceName: this.config.serviceName,
            environment: this.config.environment,
            version: this.config.version,
            pid: process.pid,
            hostname: os.hostname()
        });
    }

    /**
     * Inicializa sistema de logging estruturado
     */
    initializeLogging() {
        // Configurar formatos de log
        const logFormat = winston.format.combine(
            winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss.SSS'
            }),
            winston.format.errors({ stack: true }),
            winston.format.json(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                return JSON.stringify({
                    timestamp,
                    level: level.toUpperCase(),
                    message,
                    service: this.config.serviceName,
                    environment: this.config.environment,
                    version: this.config.version,
                    pid: process.pid,
                    hostname: os.hostname(),
                    ...meta
                });
            })
        );

        // Configurar transportes
        const transports = [];

        // Console transport (sempre ativo)
        transports.push(new winston.transports.Console({
            level: this.config.logging.level,
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }));

        // File transport
        transports.push(new winston.transports.File({
            filename: 'logs/app.log',
            level: this.config.logging.level,
            format: logFormat,
            maxsize: 50 * 1024 * 1024, // 50MB
            maxFiles: 10,
            tailable: true
        }));

        // Error file transport
        transports.push(new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: logFormat,
            maxsize: 50 * 1024 * 1024,
            maxFiles: 5
        }));

        // Cloud transport (AWS CloudWatch, Google Cloud Logging, etc.)
        if (process.env.CLOUD_LOGGING_ENABLED === 'true') {
            // Exemplo para AWS CloudWatch
            if (process.env.AWS_CLOUDWATCH_GROUP) {
                const CloudWatchTransport = require('winston-cloudwatch');
                transports.push(new CloudWatchTransport({
                    logGroupName: process.env.AWS_CLOUDWATCH_GROUP,
                    logStreamName: `capy-pay-${this.config.environment}-${os.hostname()}`,
                    awsRegion: process.env.AWS_REGION || 'us-east-1',
                    jsonMessage: true
                }));
            }

            // Exemplo para Datadog
            if (process.env.DATADOG_API_KEY) {
                const DatadogTransport = require('winston-datadog-logs');
                transports.push(new DatadogTransport({
                    apiKey: process.env.DATADOG_API_KEY,
                    hostname: os.hostname(),
                    service: this.config.serviceName,
                    source: 'nodejs',
                    tags: [`env:${this.config.environment}`, `version:${this.config.version}`]
                }));
            }
        }

        // Criar logger principal
        this.logger = winston.createLogger({
            level: this.config.logging.level,
            format: logFormat,
            transports,
            exitOnError: false
        });

        // Capturar exceções não tratadas
        this.logger.exceptions.handle(
            new winston.transports.File({ 
                filename: 'logs/exceptions.log',
                format: logFormat
            })
        );

        // Capturar promessas rejeitadas
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled Promise Rejection', {
                reason: reason.toString(),
                stack: reason.stack,
                promise: promise.toString()
            });
        });
    }

    /**
     * Inicializa sistema de coleta de métricas
     */
    initializeMetrics() {
        // Configurar Prometheus registry
        this.metricsRegistry = new prometheus.Registry();
        
        // Adicionar métricas padrão do sistema
        prometheus.collectDefaultMetrics({
            register: this.metricsRegistry,
            prefix: 'capypay_',
            gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
            labels: this.config.metrics.defaultLabels
        });

        // === MÉTRICAS DE NEGÓCIO ===

        // Transações
        this.metrics = {
            // Contadores de transações
            transactionsTotal: new prometheus.Counter({
                name: 'capypay_transactions_total',
                help: 'Total number of transactions',
                labelNames: ['type', 'status', 'user_kyc_level'],
                registers: [this.metricsRegistry]
            }),

            // Volume financeiro
            transactionVolume: new prometheus.Histogram({
                name: 'capypay_transaction_volume_brl',
                help: 'Transaction volume in BRL',
                labelNames: ['type', 'status'],
                buckets: [1, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000],
                registers: [this.metricsRegistry]
            }),

            // Usuários ativos
            activeUsers: new prometheus.Gauge({
                name: 'capypay_active_users',
                help: 'Number of active users',
                labelNames: ['period', 'kyc_level'],
                registers: [this.metricsRegistry]
            }),

            // BRcapy
            brcapyValue: new prometheus.Gauge({
                name: 'capypay_brcapy_value',
                help: 'Current BRcapy value in BRL',
                registers: [this.metricsRegistry]
            }),

            brcapySupply: new prometheus.Gauge({
                name: 'capypay_brcapy_supply_total',
                help: 'Total BRcapy supply',
                registers: [this.metricsRegistry]
            }),

            // Pool de lastro
            poolValue: new prometheus.Gauge({
                name: 'capypay_pool_value_brl',
                help: 'Pool total value in BRL',
                labelNames: ['asset'],
                registers: [this.metricsRegistry]
            }),

            // KYC
            kycVerifications: new prometheus.Counter({
                name: 'capypay_kyc_verifications_total',
                help: 'Total KYC verifications',
                labelNames: ['level', 'status', 'provider'],
                registers: [this.metricsRegistry]
            }),

            // === MÉTRICAS DE SISTEMA ===

            // Latência de APIs
            httpRequestDuration: new prometheus.Histogram({
                name: 'capypay_http_request_duration_seconds',
                help: 'Duration of HTTP requests',
                labelNames: ['method', 'route', 'status_code'],
                buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
                registers: [this.metricsRegistry]
            }),

            // Requests por segundo
            httpRequestsTotal: new prometheus.Counter({
                name: 'capypay_http_requests_total',
                help: 'Total HTTP requests',
                labelNames: ['method', 'route', 'status_code'],
                registers: [this.metricsRegistry]
            }),

            // APIs externas
            externalApiCalls: new prometheus.Counter({
                name: 'capypay_external_api_calls_total',
                help: 'External API calls',
                labelNames: ['provider', 'endpoint', 'status'],
                registers: [this.metricsRegistry]
            }),

            externalApiDuration: new prometheus.Histogram({
                name: 'capypay_external_api_duration_seconds',
                help: 'External API call duration',
                labelNames: ['provider', 'endpoint'],
                buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
                registers: [this.metricsRegistry]
            }),

            // Blockchain
            blockchainOperations: new prometheus.Counter({
                name: 'capypay_blockchain_operations_total',
                help: 'Blockchain operations',
                labelNames: ['network', 'operation', 'status'],
                registers: [this.metricsRegistry]
            }),

            // Erros
            errorsTotal: new prometheus.Counter({
                name: 'capypay_errors_total',
                help: 'Total errors',
                labelNames: ['service', 'type', 'severity'],
                registers: [this.metricsRegistry]
            })
        };

        // Iniciar coleta periódica de métricas customizadas
        this.startMetricsCollection();
    }

    /**
     * Inicializa sistema de rastreamento distribuído
     */
    initializeTracing() {
        // Para MVP, usar correlationId simples
        // Em produção, integrar com OpenTelemetry/Jaeger
        
        this.tracing = {
            // Gerar correlation ID único
            generateCorrelationId: () => {
                return `capy_${Date.now()}_${uuidv4().substring(0, 8)}`;
            },

            // Criar span de trace
            createSpan: (operationName, parentSpan = null) => {
                const spanId = uuidv4().substring(0, 8);
                const span = {
                    spanId,
                    operationName,
                    parentSpan: parentSpan?.spanId || null,
                    startTime: Date.now(),
                    tags: {},
                    logs: [],
                    status: 'active'
                };

                return span;
            },

            // Finalizar span
            finishSpan: (span, status = 'success', error = null) => {
                span.endTime = Date.now();
                span.duration = span.endTime - span.startTime;
                span.status = status;
                if (error) {
                    span.error = {
                        message: error.message,
                        stack: error.stack
                    };
                }

                this.logger.info('Span completed', {
                    spanId: span.spanId,
                    operationName: span.operationName,
                    parentSpan: span.parentSpan,
                    duration: span.duration,
                    status: span.status,
                    tags: span.tags,
                    error: span.error
                });

                return span;
            },

            // Adicionar tag ao span
            addTag: (span, key, value) => {
                span.tags[key] = value;
            },

            // Adicionar log ao span
            addLog: (span, message, data = {}) => {
                span.logs.push({
                    timestamp: Date.now(),
                    message,
                    data
                });
            }
        };
    }

    /**
     * Inicializa sistema de alertas
     */
    initializeAlerting() {
        this.alerting = {
            // Canais de notificação
            channels: {
                slack: this.sendSlackAlert.bind(this),
                email: this.sendEmailAlert.bind(this),
                pagerduty: this.sendPagerDutyAlert.bind(this)
            },

            // Histórico de alertas (evitar spam)
            alertHistory: new Map(),
            
            // Throttling de alertas
            throttleTime: 5 * 60 * 1000, // 5 minutos

            // Severidades de alerta
            severity: {
                CRITICAL: 'critical',
                HIGH: 'high',
                MEDIUM: 'medium',
                LOW: 'low'
            }
        };

        // Configurar verificações automáticas
        this.startHealthChecks();
    }

    /**
     * Middleware para rastreamento de requests HTTP
     */
    createTracingMiddleware() {
        return (req, res, next) => {
            const startTime = Date.now();
            
            // Gerar ou usar correlationId existente
            const correlationId = req.headers['x-correlation-id'] || 
                                 this.tracing.generateCorrelationId();
            
            // Adicionar ao request
            req.correlationId = correlationId;
            req.startTime = startTime;
            
            // Adicionar ao response header
            res.setHeader('X-Correlation-ID', correlationId);
            
            // Criar span principal
            const span = this.tracing.createSpan(`HTTP ${req.method} ${req.route?.path || req.path}`);
            this.tracing.addTag(span, 'http.method', req.method);
            this.tracing.addTag(span, 'http.url', req.originalUrl);
            this.tracing.addTag(span, 'http.user_agent', req.get('User-Agent'));
            this.tracing.addTag(span, 'correlation_id', correlationId);
            
            req.span = span;
            this.activeTraces.set(correlationId, span);

            // Log início da request
            this.logger.info('HTTP Request started', {
                correlationId,
                method: req.method,
                url: req.originalUrl,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                spanId: span.spanId
            });

            // Capturar fim da response
            const originalSend = res.send;
            res.send = function(data) {
                const duration = Date.now() - startTime;
                
                // Finalizar span
                const status = res.statusCode >= 400 ? 'error' : 'success';
                span.tags['http.status_code'] = res.statusCode;
                span.tags['http.response_size'] = Buffer.byteLength(data || '');
                
                // Métricas
                this.metrics.httpRequestDuration
                    .labels(req.method, req.route?.path || req.path, res.statusCode)
                    .observe(duration / 1000);
                
                this.metrics.httpRequestsTotal
                    .labels(req.method, req.route?.path || req.path, res.statusCode)
                    .inc();

                // Log fim da request
                this.logger.info('HTTP Request completed', {
                    correlationId,
                    method: req.method,
                    url: req.originalUrl,
                    statusCode: res.statusCode,
                    duration,
                    spanId: span.spanId,
                    responseSize: Buffer.byteLength(data || '')
                });

                // Finalizar span
                this.tracing.finishSpan(span, status);
                this.activeTraces.delete(correlationId);

                // Verificar se precisa alertar
                if (res.statusCode >= 500) {
                    this.sendAlert({
                        severity: this.alerting.severity.HIGH,
                        title: `HTTP 5xx Error - ${req.method} ${req.path}`,
                        message: `Status: ${res.statusCode}, Duration: ${duration}ms`,
                        correlationId,
                        metadata: {
                            method: req.method,
                            path: req.path,
                            statusCode: res.statusCode,
                            duration
                        }
                    });
                }

                return originalSend.call(this, data);
            }.bind(this);

            next();
        };
    }

    /**
     * Cria logger contextual com correlationId
     */
    createContextualLogger(correlationId, service = null) {
        return this.logger.child({
            correlationId,
            service: service || this.config.serviceName
        });
    }

    /**
     * Registra métrica de transação
     */
    recordTransaction(type, status, amount, userKycLevel = 'NONE') {
        this.metrics.transactionsTotal
            .labels(type, status, userKycLevel)
            .inc();

        if (amount) {
            this.metrics.transactionVolume
                .labels(type, status)
                .observe(amount);
        }

        this.logger.info('Transaction recorded', {
            type,
            status,
            amount,
            userKycLevel
        });
    }

    /**
     * Registra chamada para API externa
     */
    async recordExternalApiCall(provider, endpoint, operation) {
        const startTime = Date.now();
        let status = 'success';
        let error = null;

        try {
            const result = await operation();
            return result;
        } catch (err) {
            status = 'error';
            error = err;
            throw err;
        } finally {
            const duration = (Date.now() - startTime) / 1000;
            
            this.metrics.externalApiCalls
                .labels(provider, endpoint, status)
                .inc();

            this.metrics.externalApiDuration
                .labels(provider, endpoint)
                .observe(duration);

            this.logger.info('External API call', {
                provider,
                endpoint,
                status,
                duration: duration * 1000,
                error: error?.message
            });

            // Alertar se API externa está falhando
            if (status === 'error') {
                this.sendAlert({
                    severity: this.alerting.severity.MEDIUM,
                    title: `External API Error - ${provider}`,
                    message: `Endpoint: ${endpoint}, Error: ${error?.message}`,
                    metadata: { provider, endpoint, error: error?.message }
                });
            }
        }
    }

    /**
     * Registra operação blockchain
     */
    recordBlockchainOperation(network, operation, status) {
        this.metrics.blockchainOperations
            .labels(network, operation, status)
            .inc();

        this.logger.info('Blockchain operation', {
            network,
            operation,
            status
        });
    }

    /**
     * Registra erro no sistema
     */
    recordError(service, type, severity, error, correlationId = null) {
        this.metrics.errorsTotal
            .labels(service, type, severity)
            .inc();

        this.logger.error('System error', {
            service,
            type,
            severity,
            error: error.message,
            stack: error.stack,
            correlationId
        });

        // Alertar para erros críticos
        if (severity === 'critical') {
            this.sendAlert({
                severity: this.alerting.severity.CRITICAL,
                title: `Critical Error - ${service}`,
                message: `Type: ${type}, Error: ${error.message}`,
                correlationId,
                metadata: { service, type, error: error.message }
            });
        }
    }

    /**
     * Inicia coleta periódica de métricas customizadas
     */
    startMetricsCollection() {
        setInterval(() => {
            try {
                // Atualizar métricas de sistema
                const usage = process.cpuUsage();
                const memUsage = process.memoryUsage();

                // Verificar thresholds e alertar se necessário
                this.checkSystemThresholds();

                // Atualizar métricas de negócio (exemplo)
                this.updateBusinessMetrics();

            } catch (error) {
                this.logger.error('Error collecting metrics', {
                    error: error.message,
                    stack: error.stack
                });
            }
        }, this.config.metrics.collectInterval);
    }

    /**
     * Atualiza métricas de negócio
     */
    async updateBusinessMetrics() {
        try {
            // Exemplo: atualizar valor da BRcapy
            // Em produção, buscar do BRcapyService
            const mockBRcapyValue = 1.05234567;
            this.metrics.brcapyValue.set(mockBRcapyValue);

            // Exemplo: atualizar usuários ativos
            // Em produção, buscar do banco de dados
            const mockActiveUsers = 15420;
            this.metrics.activeUsers.labels('daily', 'all').set(mockActiveUsers);

        } catch (error) {
            this.logger.error('Error updating business metrics', {
                error: error.message
            });
        }
    }

    /**
     * Verifica thresholds do sistema
     */
    checkSystemThresholds() {
        const usage = process.cpuUsage();
        const memUsage = process.memoryUsage();
        const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

        // Verificar uso de memória
        if (memUsagePercent > this.config.alerting.thresholds.memoryUsage) {
            this.sendAlert({
                severity: this.alerting.severity.HIGH,
                title: 'High Memory Usage',
                message: `Memory usage: ${memUsagePercent.toFixed(1)}%`,
                metadata: { memUsage, threshold: this.config.alerting.thresholds.memoryUsage }
            });
        }
    }

    /**
     * Inicia verificações de saúde automáticas
     */
    startHealthChecks() {
        // Verificação a cada 30 segundos
        setInterval(() => {
            this.performHealthCheck();
        }, 30000);
    }

    /**
     * Executa verificação de saúde
     */
    async performHealthCheck() {
        try {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                activeTraces: this.activeTraces.size,
                services: {
                    database: await this.checkDatabaseHealth(),
                    redis: await this.checkRedisHealth(),
                    externalApis: await this.checkExternalApisHealth()
                }
            };

            // Verificar se algum serviço está unhealthy
            const unhealthyServices = Object.entries(health.services)
                .filter(([name, status]) => status !== 'healthy');

            if (unhealthyServices.length > 0) {
                health.status = 'degraded';
                
                this.sendAlert({
                    severity: this.alerting.severity.MEDIUM,
                    title: 'Service Health Degraded',
                    message: `Unhealthy services: ${unhealthyServices.map(([name]) => name).join(', ')}`,
                    metadata: { unhealthyServices }
                });
            }

            this.logger.debug('Health check completed', health);

        } catch (error) {
            this.logger.error('Health check failed', {
                error: error.message,
                stack: error.stack
            });

            this.sendAlert({
                severity: this.alerting.severity.CRITICAL,
                title: 'Health Check Failed',
                message: error.message,
                metadata: { error: error.message }
            });
        }
    }

    /**
     * Verifica saúde do banco de dados
     */
    async checkDatabaseHealth() {
        try {
            // Em produção, fazer query simples no banco
            // SELECT 1; ou similar
            return 'healthy';
        } catch (error) {
            return 'unhealthy';
        }
    }

    /**
     * Verifica saúde do Redis
     */
    async checkRedisHealth() {
        try {
            // Em produção, fazer ping no Redis
            return 'healthy';
        } catch (error) {
            return 'unhealthy';
        }
    }

    /**
     * Verifica saúde das APIs externas
     */
    async checkExternalApisHealth() {
        try {
            // Verificar APIs críticas (StarkBank, 1inch, etc.)
            return 'healthy';
        } catch (error) {
            return 'unhealthy';
        }
    }

    /**
     * Envia alerta
     */
    async sendAlert(alert) {
        try {
            const alertKey = `${alert.title}_${alert.severity}`;
            const now = Date.now();
            
            // Verificar throttling
            const lastAlert = this.alerting.alertHistory.get(alertKey);
            if (lastAlert && (now - lastAlert) < this.alerting.throttleTime) {
                return; // Não enviar alerta duplicado
            }

            // Registrar alerta
            this.alerting.alertHistory.set(alertKey, now);

            // Enriquecer alerta com contexto
            const enrichedAlert = {
                ...alert,
                timestamp: new Date().toISOString(),
                service: this.config.serviceName,
                environment: this.config.environment,
                version: this.config.version,
                hostname: os.hostname(),
                pid: process.pid
            };

            // Enviar para canais configurados
            const promises = [];
            
            if (this.config.alerting.channels.slack) {
                promises.push(this.alerting.channels.slack(enrichedAlert));
            }
            
            if (alert.severity === this.alerting.severity.CRITICAL && 
                this.config.alerting.channels.pagerduty) {
                promises.push(this.alerting.channels.pagerduty(enrichedAlert));
            }

            await Promise.allSettled(promises);

            this.logger.warn('Alert sent', enrichedAlert);

        } catch (error) {
            this.logger.error('Failed to send alert', {
                alert,
                error: error.message
            });
        }
    }

    /**
     * Envia alerta para Slack
     */
    async sendSlackAlert(alert) {
        try {
            const axios = require('axios');
            
            const color = {
                critical: '#FF0000',
                high: '#FF8C00',
                medium: '#FFD700',
                low: '#32CD32'
            }[alert.severity] || '#808080';

            const payload = {
                text: `🚨 ${alert.title}`,
                attachments: [{
                    color,
                    fields: [
                        { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
                        { title: 'Service', value: alert.service, short: true },
                        { title: 'Environment', value: alert.environment, short: true },
                        { title: 'Hostname', value: alert.hostname, short: true },
                        { title: 'Message', value: alert.message, short: false }
                    ],
                    footer: 'Capy Pay Monitoring',
                    ts: Math.floor(Date.now() / 1000)
                }]
            };

            if (alert.correlationId) {
                payload.attachments[0].fields.push({
                    title: 'Correlation ID',
                    value: alert.correlationId,
                    short: true
                });
            }

            await axios.post(this.config.alerting.channels.slack, payload);

        } catch (error) {
            this.logger.error('Failed to send Slack alert', {
                error: error.message
            });
        }
    }

    /**
     * Envia alerta por email
     */
    async sendEmailAlert(alert) {
        // Implementar integração com serviço de email (SendGrid, SES, etc.)
        this.logger.info('Email alert would be sent', alert);
    }

    /**
     * Envia alerta para PagerDuty
     */
    async sendPagerDutyAlert(alert) {
        // Implementar integração com PagerDuty
        this.logger.info('PagerDuty alert would be sent', alert);
    }

    /**
     * Expor métricas para Prometheus
     */
    getMetrics() {
        return this.metricsRegistry.metrics();
    }

    /**
     * Obter estatísticas do sistema
     */
    getSystemStats() {
        return {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            activeTraces: this.activeTraces.size,
            environment: this.config.environment,
            version: this.config.version,
            hostname: os.hostname(),
            pid: process.pid
        };
    }
}

module.exports = ObservabilityService; 