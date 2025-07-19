const express = require('express');
const { 
    observabilityMiddleware, 
    withTransactionTracking,
    withExternalApiTracking,
    withBlockchainTracking,
    financialOperationsMiddleware,
    createLogger,
    createSpan,
    finishSpan,
    addSpanTag,
    addSpanLog
} = require('../middleware/observability');

const router = express.Router();

// Aplicar observabilidade em todas as rotas
router.use(observabilityMiddleware());

/**
 * POST /api/core/exchange/initiate
 * Inicia troca de criptomoedas
 */
router.post('/exchange/initiate',
    financialOperationsMiddleware('crypto_swap'),
    withTransactionTracking('crypto_swap'),
    withBlockchainTracking('ethereum', 'swap'),
    async (req, res) => {
        const logger = createLogger(req.correlationId, 'core-exchange');
        const span = createSpan('crypto_swap_initiation', req.span);
        
        try {
            const { fromToken, toToken, amount, slippage } = req.body;
            
            // Adicionar tags ao span
            addSpanTag(span, 'swap.from_token', fromToken);
            addSpanTag(span, 'swap.to_token', toToken);
            addSpanTag(span, 'swap.amount', amount);
            addSpanTag(span, 'swap.slippage', slippage);
            
            logger.info('Crypto swap initiated', {
                fromToken,
                toToken,
                amount,
                slippage,
                userId: req.user?.id
            });

            // Simular chamada para 1inch API
            const quoteResult = await withExternalApiTracking('1inch', '/v5.0/1/quote')(async () => {
                addSpanLog(span, 'Fetching quote from 1inch');
                
                // Simulação de chamada API
                await new Promise(resolve => setTimeout(resolve, 200));
                
                return {
                    toTokenAmount: (parseFloat(amount) * 0.95).toString(),
                    estimatedGas: '21000',
                    protocols: [['UNISWAP_V3']]
                };
            });

            addSpanLog(span, 'Quote received', { quote: quoteResult });

            // Simular execução do swap
            const swapResult = await withExternalApiTracking('1inch', '/v5.0/1/swap')(async () => {
                addSpanLog(span, 'Executing swap transaction');
                
                // Simulação de execução
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                return {
                    tx: {
                        hash: '0x' + Math.random().toString(16).substring(2),
                        gasPrice: '20000000000',
                        gasUsed: '150000'
                    }
                };
            });

            addSpanTag(span, 'transaction.hash', swapResult.tx.hash);
            addSpanTag(span, 'transaction.gas_used', swapResult.tx.gasUsed);

            logger.info('Crypto swap completed successfully', {
                transactionHash: swapResult.tx.hash,
                gasUsed: swapResult.tx.gasUsed,
                fromToken,
                toToken,
                inputAmount: amount,
                outputAmount: quoteResult.toTokenAmount
            });

            finishSpan(span, 'success');

            res.json({
                success: true,
                data: {
                    transactionHash: swapResult.tx.hash,
                    inputAmount: amount,
                    outputAmount: quoteResult.toTokenAmount,
                    gasUsed: swapResult.tx.gasUsed,
                    protocols: quoteResult.protocols,
                    correlationId: req.correlationId
                }
            });

        } catch (error) {
            logger.error('Crypto swap failed', {
                error: error.message,
                stack: error.stack,
                fromToken,
                toToken,
                amount
            });

            addSpanLog(span, 'Swap failed', { error: error.message });
            finishSpan(span, 'error', error);

            res.status(500).json({
                success: false,
                error: 'Falha na troca de criptomoedas',
                correlationId: req.correlationId
            });
        }
    }
);

/**
 * POST /api/core/boleto/initiate
 * Inicia pagamento de boleto
 */
router.post('/boleto/initiate',
    financialOperationsMiddleware('boleto_payment'),
    withTransactionTracking('boleto_payment'),
    async (req, res) => {
        const logger = createLogger(req.correlationId, 'core-boleto');
        const span = createSpan('boleto_payment_initiation', req.span);
        
        try {
            const { boletoCode, amount, payerInfo } = req.body;
            
            // Adicionar tags ao span
            addSpanTag(span, 'boleto.code', boletoCode);
            addSpanTag(span, 'boleto.amount', amount);
            addSpanTag(span, 'boleto.payer_id', payerInfo?.id);
            
            logger.info('Boleto payment initiated', {
                boletoCode,
                amount,
                payerInfo,
                userId: req.user?.id
            });

            // Simular chamada para StarkBank API
            const paymentResult = await withExternalApiTracking('starkbank', '/v2/boleto-payment')(async () => {
                addSpanLog(span, 'Processing boleto payment via StarkBank');
                
                // Simulação de processamento
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                return {
                    id: 'bp_' + Math.random().toString(36).substring(2),
                    status: 'success',
                    fee: Math.round(parseFloat(amount) * 0.015 * 100) / 100, // 1.5% fee
                    scheduled: new Date().toISOString()
                };
            });

            addSpanTag(span, 'payment.id', paymentResult.id);
            addSpanTag(span, 'payment.fee', paymentResult.fee);
            addSpanTag(span, 'payment.status', paymentResult.status);

            logger.info('Boleto payment completed successfully', {
                paymentId: paymentResult.id,
                boletoCode,
                amount,
                fee: paymentResult.fee,
                status: paymentResult.status
            });

            // Simular processamento de revenue para BRcapy
            const revenueAmount = paymentResult.fee;
            addSpanLog(span, 'Processing revenue for BRcapy', { revenueAmount });

            finishSpan(span, 'success');

            res.json({
                success: true,
                data: {
                    paymentId: paymentResult.id,
                    boletoCode,
                    amount: parseFloat(amount),
                    fee: paymentResult.fee,
                    status: paymentResult.status,
                    scheduledFor: paymentResult.scheduled,
                    correlationId: req.correlationId
                }
            });

        } catch (error) {
            logger.error('Boleto payment failed', {
                error: error.message,
                stack: error.stack,
                boletoCode,
                amount
            });

            addSpanLog(span, 'Boleto payment failed', { error: error.message });
            finishSpan(span, 'error', error);

            res.status(500).json({
                success: false,
                error: 'Falha no pagamento do boleto',
                correlationId: req.correlationId
            });
        }
    }
);

/**
 * GET /api/core/transaction/:transactionId/status
 * Verifica status de uma transação
 */
router.get('/transaction/:transactionId/status',
    async (req, res) => {
        const logger = createLogger(req.correlationId, 'core-transaction');
        const span = createSpan('transaction_status_check', req.span);
        
        try {
            const { transactionId } = req.params;
            
            addSpanTag(span, 'transaction.id', transactionId);
            
            logger.info('Checking transaction status', {
                transactionId,
                userId: req.user?.id
            });

            // Simular verificação de status
            const statusResult = await withExternalApiTracking('blockchain', '/transaction/status')(async () => {
                addSpanLog(span, 'Querying blockchain for transaction status');
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const statuses = ['pending', 'confirmed', 'failed'];
                const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
                
                return {
                    transactionId,
                    status: randomStatus,
                    confirmations: randomStatus === 'confirmed' ? 12 : 0,
                    blockNumber: randomStatus === 'confirmed' ? 18500000 + Math.floor(Math.random() * 1000) : null,
                    gasUsed: randomStatus === 'confirmed' ? '21000' : null
                };
            });

            addSpanTag(span, 'transaction.status', statusResult.status);
            addSpanTag(span, 'transaction.confirmations', statusResult.confirmations);

            logger.info('Transaction status retrieved', {
                transactionId,
                status: statusResult.status,
                confirmations: statusResult.confirmations,
                blockNumber: statusResult.blockNumber
            });

            finishSpan(span, 'success');

            res.json({
                success: true,
                data: statusResult
            });

        } catch (error) {
            logger.error('Failed to check transaction status', {
                error: error.message,
                transactionId: req.params.transactionId
            });

            addSpanLog(span, 'Status check failed', { error: error.message });
            finishSpan(span, 'error', error);

            res.status(500).json({
                success: false,
                error: 'Falha ao verificar status da transação',
                correlationId: req.correlationId
            });
        }
    }
);

/**
 * GET /api/core/health
 * Health check específico do CoreService
 */
router.get('/health', async (req, res) => {
    const logger = createLogger(req.correlationId, 'core-health');
    
    try {
        const health = {
            service: 'core',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            dependencies: {
                '1inch': await checkExternalService('1inch'),
                'starkbank': await checkExternalService('starkbank'),
                'blockchain_rpc': await checkExternalService('blockchain')
            }
        };

        // Verificar se alguma dependência está unhealthy
        const unhealthyDeps = Object.entries(health.dependencies)
            .filter(([name, status]) => status !== 'healthy');

        if (unhealthyDeps.length > 0) {
            health.status = 'degraded';
            logger.warn('Core service degraded', {
                unhealthyDependencies: unhealthyDeps
            });
        }

        res.json(health);

    } catch (error) {
        logger.error('Core health check failed', {
            error: error.message
        });

        res.status(500).json({
            service: 'core',
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Helper para verificar serviços externos
 */
async function checkExternalService(serviceName) {
    try {
        // Simular verificação de saúde
        await new Promise(resolve => setTimeout(resolve, 100));
        return Math.random() > 0.1 ? 'healthy' : 'unhealthy';
    } catch (error) {
        return 'unhealthy';
    }
}

module.exports = router; 