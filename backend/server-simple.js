const express = require('express');
const cors = require('cors'); // Para permitir requisições do frontend
const bodyParser = require('body-parser'); // Para parsear o corpo das requisições

const app = express();
const port = 3001; // Porta do backend

// Middlewares
app.use(cors()); // Permite requisições de outras origens (seu frontend)
app.use(bodyParser.json()); // Para parsear JSON no corpo das requisições

// Dados mockados para a demonstração
const MOCK_USER_BALANCE_USDC = 1500.00; // Saldo inicial simulado
const MOCK_BOLETO_VALUE_BRL = 850.00; // Valor fixo do boleto para demo
const MOCK_USDC_TO_BRL_RATE = 5.00; // Taxa de câmbio simulada: 1 USDC = 5.00 BRL
const SERVICE_FEE_PERCENT = 1.5; // Taxa de serviço 1.5%

// Endpoint para simular o parse do boleto
app.post('/api/demo/boleto/parse', (req, res) => {
    const { barcode } = req.body;
    console.log(`[BACKEND] Recebida requisição de parse de boleto para: ${barcode}`);

    // Simula um delay de processamento
    setTimeout(() => {
        if (!barcode || barcode.length < 10) { // Validação mínima para demo
            return res.status(400).json({ 
                success: false,
                error: {
                    code: "INVALID_BARCODE",
                    message: 'Código de barras inválido para demonstração.'
                }
            });
        }

        const serviceFeeAmount = MOCK_BOLETO_VALUE_BRL * SERVICE_FEE_PERCENT / 100;
        const totalBRL = MOCK_BOLETO_VALUE_BRL + serviceFeeAmount;
        const requiredUSDC = totalBRL / MOCK_USDC_TO_BRL_RATE;

        const response = {
            success: true,
            data: {
                barcode: barcode,
                beneficiario: 'ENEL DISTRIBUIÇÃO GOIÁS',
                valor: MOCK_BOLETO_VALUE_BRL,
                vencimento: '2024-01-25',
                banco: '341 - Itaú',
                status: 'No prazo',
                conversion: {
                    rate: MOCK_USDC_TO_BRL_RATE,
                    serviceFee: SERVICE_FEE_PERCENT,
                    usdcNeeded: parseFloat(requiredUSDC.toFixed(2)),
                    serviceFeeAmount: parseFloat(serviceFeeAmount.toFixed(2))
                }
            }
        };

        res.json(response);
        console.log(`[BACKEND] Resposta de parse de boleto enviada.`);
    }, 1500); // Simula 1.5 segundos de processamento
});

// Endpoint para simular o pagamento do boleto
app.post('/api/demo/boleto/pay', (req, res) => {
    const { userId, barcode, usdcAmount } = req.body;
    console.log(`[BACKEND] Recebida requisição de pagamento de boleto para ${barcode} (Usuário: ${userId}, USDC: ${usdcAmount})`);

    // Simula um delay de processamento (swap, StarkBank, blockchain)
    setTimeout(() => {
        if (usdcAmount > MOCK_USER_BALANCE_USDC) {
            return res.status(400).json({ 
                success: false,
                error: {
                    code: "INSUFFICIENT_BALANCE",
                    message: 'Saldo insuficiente para a demonstração.'
                }
            });
        }
        
        // Simula um ID de transação
        const transactionId = `CP${Date.now().toString().slice(-8)}`;
        const newBalance = MOCK_USER_BALANCE_USDC - usdcAmount;
        
        // Em um cenário real, aqui você registraria a transação e atualizaria saldos
        console.log(`[BACKEND] Pagamento simulado com sucesso. ID da transação: ${transactionId}`);

        const response = {
            success: true,
            data: {
                transactionId,
                status: "completed",
                paidAmount: MOCK_BOLETO_VALUE_BRL,
                usdcUsed: usdcAmount,
                newBalance: parseFloat(newBalance.toFixed(2)),
                timestamp: new Date().toISOString(),
                receipt: {
                    id: transactionId,
                    beneficiario: 'ENEL DISTRIBUIÇÃO GOIÁS',
                    valor: MOCK_BOLETO_VALUE_BRL,
                    usdcUsed: usdcAmount,
                    rate: MOCK_USDC_TO_BRL_RATE,
                    timestamp: new Date().toLocaleString('pt-BR')
                }
            }
        };

        res.json(response);
        console.log(`[BACKEND] Resposta de pagamento de boleto enviada.`);
    }, 4000); // Simula 4 segundos de processamento (incluindo swap/pagamento)
});

// Endpoint para simular o saldo do usuário
app.get('/api/demo/user/balance', (req, res) => {
    console.log(`[BACKEND] Requisição de saldo do usuário.`);
    
    const response = {
        success: true,
        data: {
            usdc: MOCK_USER_BALANCE_USDC,
            brl: 0, // Assume que o BRL é convertido na hora
            capy_points: 1250
        }
    };
    
    res.json(response);
});

// Status da demo
app.get('/api/demo/status', (req, res) => {
    console.log('[BACKEND] Status da demo solicitado');
    
    res.json({
        success: true,
        data: {
            status: "Demo API Running",
            timestamp: new Date().toISOString(),
            endpoints: [
                "POST /api/demo/boleto/parse",
                "POST /api/demo/boleto/pay", 
                "GET /api/demo/user/balance",
                "GET /api/demo/status"
            ]
        }
    });
});

// Endpoint de health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'Backend is running!'
    });
});

// Middleware de erro global
app.use((err, req, res, next) => {
    console.error('[BACKEND ERROR]', err);
    res.status(500).json({
        success: false,
        error: {
            code: "INTERNAL_ERROR",
            message: "Erro interno do servidor"
        }
    });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: "NOT_FOUND",
            message: `Rota ${req.method} ${req.originalUrl} não encontrada`
        }
    });
});

app.listen(port, () => {
    console.log(`🚀 [BACKEND] Servidor backend mockado rodando em http://localhost:${port}`);
    console.log(`📋 [BACKEND] Endpoints disponíveis:`);
    console.log(`   - GET  /health`);
    console.log(`   - GET  /api/demo/status`);
    console.log(`   - GET  /api/demo/user/balance`);
    console.log(`   - POST /api/demo/boleto/parse`);
    console.log(`   - POST /api/demo/boleto/pay`);
    console.log(`✅ [BACKEND] Pronto para demonstração!`);
}); 