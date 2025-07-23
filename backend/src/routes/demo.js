const express = require('express');
const router = express.Router();

// Mock data para demonstração
const DEMO_DATA = {
  user: {
    id: "demo_user_123",
    name: "João Silva",
    balance: { usdc: 1500, brl: 0, capy_points: 1250 }
  },
  
  boleto: {
    barcode: "34191790010104351004791020150008291070026000",
    beneficiario: "ENEL DISTRIBUIÇÃO GOIÁS",
    valor: 850.00,
    vencimento: "2024-01-25",
    banco: "341 - Itaú",
    status: "No prazo"
  },
  
  exchange: {
    rate_usd_brl: 5.00,
    service_fee_percent: 1.5,
    usdc_needed: 172.55 // (850 / 5) * 1.015
  }
};

// Parse do código de barras (simulado)
router.post('/boleto/parse', (req, res) => {
  const { barcode } = req.body;
  
  console.log(`[DEMO] Parsing boleto: ${barcode}`);
  
  // Simula delay de API real
  setTimeout(() => {
    if (barcode === DEMO_DATA.boleto.barcode) {
      res.json({
        success: true,
        data: {
          ...DEMO_DATA.boleto,
          conversion: {
            rate: DEMO_DATA.exchange.rate_usd_brl,
            serviceFee: DEMO_DATA.exchange.service_fee_percent,
            usdcNeeded: DEMO_DATA.exchange.usdc_needed,
            serviceFeeAmount: (DEMO_DATA.boleto.valor * DEMO_DATA.exchange.service_fee_percent / 100)
          }
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_BARCODE",
          message: "Código de barras inválido ou boleto não encontrado"
        }
      });
    }
  }, 1500); // 1.5s delay
});

// Pagamento do boleto (simulado)
router.post('/boleto/pay', (req, res) => {
  const { barcode, usdcAmount, userId } = req.body;
  
  console.log(`[DEMO] Processing payment: ${usdcAmount} USDC for boleto ${barcode}`);
  
  // Simula processamento com steps
  let step = 1;
  const steps = [
    { id: 1, message: "Validando boleto...", delay: 1000 },
    { id: 2, message: "Convertendo USDC → BRL...", delay: 1500 },
    { id: 3, message: "Processando pagamento...", delay: 2000 },
    { id: 4, message: "Pagamento realizado!", delay: 500 }
  ];
  
  setTimeout(() => {
    const transactionId = `CP${Date.now().toString().slice(-8)}`;
    const newBalance = DEMO_DATA.user.balance.usdc - usdcAmount;
    
    res.json({
      success: true,
      data: {
        transactionId,
        status: "completed",
        paidAmount: DEMO_DATA.boleto.valor,
        usdcUsed: usdcAmount,
        newBalance,
        timestamp: new Date().toISOString(),
        receipt: {
          id: transactionId,
          beneficiario: DEMO_DATA.boleto.beneficiario,
          valor: DEMO_DATA.boleto.valor,
          usdcUsed: usdcAmount,
          rate: DEMO_DATA.exchange.rate_usd_brl,
          timestamp: new Date().toLocaleString('pt-BR')
        }
      }
    });
  }, 4000); // 4s total delay
});

// Saldo do usuário
router.get('/user/balance', (req, res) => {
  console.log('[DEMO] Getting user balance');
  
  res.json({
    success: true,
    data: DEMO_DATA.user.balance
  });
});

// Status da demo
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: "Demo API Running",
      timestamp: new Date().toISOString(),
      endpoints: [
        "POST /api/demo/boleto/parse",
        "POST /api/demo/boleto/pay", 
        "GET /api/demo/user/balance"
      ]
    }
  });
});

module.exports = router; 