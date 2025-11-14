require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

// Import routes (safe in dev to avoid blocking startup)
const safeRequire = (p) => {
    try {
        const mod = require(p);
        console.log(`[DEBUG] Loaded route module: ${p}`);
        return mod;
    } catch (e) {
        console.log(`[DEBUG] Failed to require route ${p}: ${e.message}`);
        return null;
    }
};

const authRoutes = safeRequire('./routes/auth');
const coreRoutes = safeRequire('./routes/core');
const tokenomicsRoutes = safeRequire('./routes/tokenomics');
const referralRoutes = safeRequire('./routes/referral');
const notificationsRoutes = safeRequire('./routes/notifications');
const kycRoutes = safeRequire('./routes/kyc');
const brcapyRoutes = safeRequire('./routes/brcapy');
const paymentsRoutes = safeRequire('./routes/payments');
const starkbankWebhookRoutes = safeRequire('./routes/webhooks');
const demoRoutes = safeRequire('./routes/demo');
const depositsRoutes = safeRequire('./routes/deposits');
const blockchainRoutes = safeRequire('./routes/blockchain');
const walletRoutes = safeRequire('./routes/wallets');

const app = express();
const PORT = process.env.PORT || 3001;
console.log('[DEBUG] server.js start: app and PORT initialized');
try {
    const fs = require('fs');
    fs.writeFileSync('logs/startup.marker', new Date().toISOString());
    console.log('[DEBUG] wrote logs/startup.marker');
} catch (e) {
    console.log('[DEBUG] failed to write startup marker', e.message);
}

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/app.log' }),
        new winston.transports.Console()
    ]
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'https://capypay.app',
        'https://*.capypay.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Internal-API-Key']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 requests per windowMs for auth
    message: {
        error: 'Too many authentication attempts, please try again later.'
    }
});

// Notification-specific rate limiting
const notificationLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 notification requests per minute
    message: {
        error: 'Too many notification requests, please try again later.'
    }
});

// KYC-specific rate limiting (more restrictive for sensitive operations)
const kycLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // limit each IP to 50 KYC requests per hour
    message: {
        error: 'Too many KYC requests, please try again later.'
    }
});

// BRcapy-specific rate limiting (financial operations)
const brcapyLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 BRcapy requests per minute
    message: {
        error: 'Too many BRcapy requests, please try again later.'
    }
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        services: {
            kyc: 'operational',
            limits: 'operational',
            notifications: 'operational',
            tokenomics: 'operational',
            referral: 'operational',
            brcapy: 'operational',
            pool: 'operational'
        }
    });
});

// API routes
console.log('[DEBUG] mounting API routes...');
if (authRoutes) app.use('/api/auth', authLimiter, authRoutes);
if (coreRoutes) app.use('/api/core', coreRoutes);
if (tokenomicsRoutes) app.use('/api/tokenomics', tokenomicsRoutes);
if (referralRoutes) app.use('/api/referral', referralRoutes);
if (notificationsRoutes) app.use('/api/notifications', notificationLimiter, notificationsRoutes);
if (kycRoutes) app.use('/api/kyc', kycLimiter, kycRoutes);
if (brcapyRoutes) app.use('/api/brcapy', brcapyLimiter, brcapyRoutes);
if (paymentsRoutes) app.use('/api/payments', paymentsRoutes);
if (starkbankWebhookRoutes) app.use('/api/starkbank', starkbankWebhookRoutes);
if (depositsRoutes) app.use('/api/deposits', depositsRoutes);
if (blockchainRoutes) app.use('/api/blockchain', blockchainRoutes);
if (walletRoutes) app.use('/api/wallets', walletRoutes);
if (demoRoutes) app.use('/api/demo', demoRoutes); // Demo routes for hackathon
console.log('[DEBUG] API routes mounted');

// Catch-all for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        path: req.path,
        method: req.method
    });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip
    });

    // Don't expose error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
        success: false,
        error: isDevelopment ? err.message : 'Internal server error',
        ...(isDevelopment && { stack: err.stack })
    });
});

// 404 handler for non-API routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.path
    });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

// Start server
console.log(`[DEBUG] Attempting to start server on port ${PORT}...`);
const server = app.listen(PORT, () => {
    logger.info(`🐹 Capy Pay Backend Server running on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
    
    logger.info('📡 Available API endpoints:', {
        endpoints: [
            'GET  /health - Health check',
            'POST /api/payments/pix/generate - Generate PIX QR code',
            'POST /api/payments/pix/simulate-credit - Simulate PIX credit (local)',
            'POST /api/payments/bill/pay - Pay boleto',
            'GET  /api/payments/transaction/:id - Get transaction',
            'GET  /api/payments/transactions - List user transactions',
            'GET  /api/deposits - List user deposits',
            'GET  /api/payments/status - Payments service status',
            'POST /api/starkbank/webhook - StarkBank webhook receiver',
            'POST /api/starkbank/webhook/setup - Configure StarkBank webhook',
            'GET  /api/starkbank/webhook/test - Test webhook endpoint',
            'POST /api/auth/login - Google OAuth login',
            'GET  /api/auth/profile - User profile',
            'GET  /api/auth/wallet/address - Wallet address',
            'POST /api/core/exchange/initiate - Start crypto exchange',
            'POST /api/core/boleto/initiate - Start boleto payment',
            'GET  /api/tokenomics/dashboard - Tokenomics dashboard',
            'GET  /api/referral/profile - Referral profile',
            'POST /api/referral/generate - Generate referral link',
            'GET  /api/referral/click/:code - Track referral click',
            'POST /api/referral/convert - Process referral conversion',
            'POST /api/notifications/credentials - Save notification credentials',
            'POST /api/notifications/test - Send test notification',
            'GET  /api/notifications/history - Notification history',
            'GET  /api/kyc/status - Get KYC status',
            'POST /api/kyc/level1 - Submit Level 1 KYC',
            'POST /api/kyc/level2 - Submit Level 2 KYC',
            'POST /api/kyc/level3 - Submit Level 3 KYC',
            'GET  /api/kyc/limits - Get transaction limits',
            'POST /api/kyc/check-limit - Check transaction limit',
            'GET  /api/kyc/requirements/:level - Get KYC requirements',
            'GET  /api/brcapy/dashboard - BRcapy dashboard data',
            'GET  /api/brcapy/user/:userId - User BRcapy balance',
            'GET  /api/brcapy/current-value - Current BRcapy value',
            'POST /api/brcapy/distribute - Distribute BRcapy tokens',
            'POST /api/brcapy/redeem - Redeem BRcapy tokens',
            'GET  /api/brcapy/history/:userId - User BRcapy history',
            'GET  /api/brcapy/pool - Pool management data',
            'POST /api/brcapy/process-transaction-revenue - Process app revenue',
            'POST /api/brcapy/force-update - Force BRcapy value update',
            'GET  /api/brcapy/metrics - BRcapy system metrics',
            'GET  /api/brcapy/cdi-data - Current CDI data',
            'GET  /api/brcapy/yield-calculation - Yield projection calculator'
        ]
    });
});

module.exports = app;