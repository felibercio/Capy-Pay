const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

// Import routes
const authRoutes = require('./routes/auth');
const coreRoutes = require('./routes/core');
const tokenomicsRoutes = require('./routes/tokenomics');
const referralRoutes = require('./routes/referral');
const notificationsRoutes = require('./routes/notifications');
const kycRoutes = require('./routes/kyc');
const brcapyRoutes = require('./routes/brcapy');

const app = express();
const PORT = process.env.PORT || 3001;

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
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/core', coreRoutes);
app.use('/api/tokenomics', tokenomicsRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/notifications', notificationLimiter, notificationsRoutes);
app.use('/api/kyc', kycLimiter, kycRoutes);
app.use('/api/brcapy', brcapyLimiter, brcapyRoutes);

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
const server = app.listen(PORT, () => {
    logger.info(`🐹 Capy Pay Backend Server running on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
    
    logger.info('📡 Available API endpoints:', {
        endpoints: [
            'GET  /health - Health check',
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