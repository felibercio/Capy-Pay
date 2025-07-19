# 📡 API Specification - Capy Pay

## Visão Geral

Esta especificação define todos os endpoints da API REST do Capy Pay, integrando autenticação, transações, KYC, tokenomics, referrals, notificações e administração.

### Base URL
```
Development: https://api-dev.capypay.com/api/v1
Production: https://api.capypay.com/api/v1
```

### Autenticação
Todas as rotas protegidas requerem header:
```
Authorization: Bearer <jwt_token>
```

### Headers Padrão
```
Content-Type: application/json
Accept: application/json
X-Correlation-ID: <correlation_id> (opcional, gerado se não fornecido)
Idempotency-Key: <unique_key> (obrigatório para operações POST/PUT críticas)
```

### Formato de Response Padrão
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-15T14:30:45.123Z",
    "correlationId": "capy_1705327845123_a1b2c3d4",
    "version": "1.0.0"
  }
}
```

### Formato de Erro Padrão
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T14:30:45.123Z",
    "correlationId": "capy_1705327845123_a1b2c3d4",
    "supportReference": "capy_1705327845123_a1b2c3d4"
  }
}
```

---

## 🔐 Autenticação e Usuários

### POST /auth/google-login
Autenticação via Google OAuth com verificação de fraudes.

**Request:**
```json
{
  "googleToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2NzAyN...",
  "miniKitData": {
    "frameUrl": "https://t.me/CapyPayBot/app",
    "userId": "telegram_user_123",
    "chatId": "chat_456"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_abc123",
      "email": "user@example.com",
      "name": "João Silva",
      "picture": "https://lh3.googleusercontent.com/...",
      "walletAddress": "0x742d35Cc6634C0532925a3b8D404d",
      "createdAt": "2024-01-15T14:30:45.123Z",
      "kycStatus": "NONE",
      "kycLevel": "NONE",
      "preferences": {
        "language": "pt-BR",
        "notifications": true
      }
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "rt_abc123def456...",
    "sessionId": "session_789xyz",
    "expiresIn": 3600
  }
}
```

**Response (403 - Fraud Block):**
```json
{
  "success": false,
  "error": {
    "code": "LOGIN_BLOCKED",
    "message": "Access denied due to security concerns"
  }
}
```

### POST /auth/refresh
Renovar token de acesso.

**Request:**
```json
{
  "refreshToken": "rt_abc123def456..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "rt_new123def456...",
    "expiresIn": 3600,
    "user": {
      "id": "user_abc123",
      "email": "user@example.com",
      "kycStatus": "LEVEL_1"
    }
  }
}
```

### POST /auth/logout
Encerrar sessão.

**Request:** (Apenas headers de autenticação)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Logout successful"
  }
}
```

### GET /auth/me
Obter perfil do usuário autenticado.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_abc123",
      "email": "user@example.com",
      "name": "João Silva",
      "picture": "https://lh3.googleusercontent.com/...",
      "walletAddress": "0x742d35Cc6634C0532925a3b8D404d",
      "createdAt": "2024-01-15T14:30:45.123Z",
      "kycStatus": "LEVEL_1",
      "kycLevel": "LEVEL_1",
      "preferences": {
        "language": "pt-BR",
        "notifications": true
      },
      "balances": {
        "capyPoints": 1250,
        "capyCoins": 50.75,
        "brcapy": 1000.50
      },
      "limits": {
        "daily": {
          "current": 2500.00,
          "maximum": 5000.00,
          "used": 2500.00,
          "remaining": 2500.00
        },
        "monthly": {
          "current": 15000.00,
          "maximum": 50000.00,
          "used": 35000.00,
          "remaining": 15000.00
        }
      },
      "reviewRequired": false
    }
  }
}
```

### GET /auth/sessions
Listar sessões ativas do usuário.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session_789xyz",
        "createdAt": "2024-01-15T14:30:45.123Z",
        "lastAccessAt": "2024-01-15T16:45:30.456Z",
        "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        "ipAddress": "192.168.***.***",
        "isCurrent": true
      }
    ]
  }
}
```

### DELETE /auth/sessions/:sessionId
Revogar sessão específica.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Session revoked successfully"
  }
}
```

---

## 💱 Core - Câmbio e Transações

### GET /core/swap/quote
Obter cotação para swap de criptomoedas.

**Query Parameters:**
- `fromToken` (required): Token de origem (USDC, ETH, BTC)
- `toToken` (required): Token de destino (BRL, USDC, ETH)
- `amount` (required): Valor a ser convertido
- `slippage` (optional): Slippage tolerado (default: 0.5)

**Example:** `/core/swap/quote?fromToken=USDC&toToken=BRL&amount=1000&slippage=0.5`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "quote": {
      "fromToken": "USDC",
      "toToken": "BRL",
      "fromAmount": 1000,
      "toAmount": 5234.50,
      "exchangeRate": 5.2345,
      "slippage": 0.5,
      "estimatedGas": "0.002 ETH",
      "fees": {
        "platform": 15.70, // 0.3%
        "network": 10.50,
        "total": 26.20
      },
      "route": [
        {
          "protocol": "1inch",
          "percentage": 100
        }
      ],
      "validUntil": "2024-01-15T14:35:45.123Z",
      "priceImpact": 0.12
    }
  }
}
```

### POST /core/swap/initiate
Iniciar swap de criptomoedas.

**Request:**
```json
{
  "fromToken": "USDC",
  "toToken": "BRL",
  "amount": 1000,
  "slippage": 0.5,
  "destinationDetails": {
    "pixKey": "user@example.com",
    "bankAccount": {
      "bank": "341",
      "agency": "1234",
      "account": "12345-6",
      "accountType": "checking"
    }
  },
  "quoteId": "quote_abc123" // Opcional, para usar cotação pré-calculada
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "tx_swap_abc123",
      "type": "crypto_swap",
      "status": "pending_confirmation",
      "fromToken": "USDC",
      "toToken": "BRL",
      "fromAmount": 1000,
      "estimatedToAmount": 5208.30, // Após fees
      "exchangeRate": 5.2345,
      "fees": {
        "platform": 15.70,
        "network": 10.50,
        "total": 26.20
      },
      "estimatedCompletion": "2024-01-15T14:35:45.123Z",
      "depositAddress": "0x742d35Cc6634C0532925a3b8D404d", // Se necessário
      "steps": [
        {
          "step": 1,
          "description": "Confirmar transação na carteira",
          "status": "pending"
        },
        {
          "step": 2,
          "description": "Executar swap na blockchain",
          "status": "waiting"
        },
        {
          "step": 3,
          "description": "Processar pagamento PIX",
          "status": "waiting"
        }
      ]
    }
  }
}
```

**Response (403 - Fraud Block):**
```json
{
  "success": false,
  "error": {
    "code": "TRANSACTION_BLOCKED",
    "message": "Transaction blocked due to security concerns"
  }
}
```

**Response (429 - Rate Limit):**
```json
{
  "success": false,
  "error": {
    "code": "VELOCITY_LIMIT_EXCEEDED",
    "message": "Transaction velocity limits exceeded",
    "details": [
      "Transaction frequency: 15/hour (limit: 10)",
      "Hourly volume: R$ 15000 (limit: R$ 10000)"
    ],
    "retryAfter": "3600"
  }
}
```

### GET /core/swap/status/:transactionId
Verificar status de swap.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "tx_swap_abc123",
      "status": "completed",
      "fromToken": "USDC",
      "toToken": "BRL",
      "fromAmount": 1000,
      "toAmount": 5208.30,
      "exchangeRate": 5.2345,
      "completedAt": "2024-01-15T14:38:22.456Z",
      "blockchainTx": {
        "hash": "0x1234567890abcdef...",
        "blockNumber": 18500123,
        "confirmations": 12,
        "gasUsed": "150000"
      },
      "pixPayment": {
        "pixId": "pix_789xyz",
        "status": "completed",
        "paidAt": "2024-01-15T14:38:22.456Z"
      },
      "fees": {
        "platform": 15.70,
        "network": 10.50,
        "total": 26.20
      }
    }
  }
}
```

### POST /core/boleto/initiate
Iniciar pagamento de boleto.

**Request:**
```json
{
  "boletoCode": "34191790010104351004791020150008291070026000",
  "amount": 500.00, // Opcional se valor já estiver no código
  "payerInfo": {
    "name": "João Silva",
    "document": "123.456.789-01",
    "email": "user@example.com"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "tx_boleto_abc123",
      "type": "boleto_payment",
      "status": "pending_crypto_deposit",
      "boletoCode": "34191790010104351004791020150008291070026000",
      "amount": 500.00,
      "dueDate": "2024-01-30T23:59:59.999Z",
      "recipient": {
        "name": "Empresa XYZ Ltda",
        "document": "12.345.678/0001-90"
      },
      "paymentDetails": {
        "requiredStablecoin": "USDC",
        "requiredAmount": 95.50, // Considerando taxa de câmbio
        "depositAddress": "0x742d35Cc6634C0532925a3b8D404d",
        "exchangeRate": 5.2345,
        "fees": {
          "platform": 7.50,
          "starkbank": 2.50,
          "total": 10.00
        }
      },
      "estimatedCompletion": "2024-01-15T15:00:00.000Z"
    }
  }
}
```

### GET /core/boleto/status/:transactionId
Verificar status de pagamento de boleto.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "tx_boleto_abc123",
      "status": "completed",
      "boletoCode": "34191790010104351004791020150008291070026000",
      "amount": 500.00,
      "paidAt": "2024-01-15T14:45:33.789Z",
      "starkbankPayment": {
        "id": "bp_starkbank_123",
        "status": "paid",
        "fee": 2.50
      },
      "cryptoDeposit": {
        "txHash": "0x987654321fedcba...",
        "amount": 95.50,
        "token": "USDC",
        "confirmations": 12
      }
    }
  }
}
```

### GET /core/transaction/:transactionId
Obter detalhes de qualquer transação.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "tx_swap_abc123",
      "type": "crypto_swap",
      "status": "completed",
      "createdAt": "2024-01-15T14:30:45.123Z",
      "updatedAt": "2024-01-15T14:38:22.456Z",
      "completedAt": "2024-01-15T14:38:22.456Z",
      "fromToken": "USDC",
      "toToken": "BRL",
      "fromAmount": 1000,
      "toAmount": 5208.30,
      "exchangeRate": 5.2345,
      "fees": {
        "platform": 15.70,
        "network": 10.50,
        "total": 26.20
      },
      "externalReferences": {
        "blockchainTx": "0x1234567890abcdef...",
        "starkbankId": "bp_starkbank_123",
        "oneInchTx": "0x987654321fedcba..."
      },
      "fraudAnalysis": {
        "riskScore": 15,
        "riskLevel": "LOW",
        "decision": "ALLOW"
      }
    }
  }
}
```

### GET /core/transactions
Listar transações do usuário.

**Query Parameters:**
- `limit` (optional): Limite de resultados (default: 20, max: 100)
- `offset` (optional): Offset para paginação (default: 0)
- `type` (optional): Filtrar por tipo (swap, boleto_payment, withdrawal)
- `status` (optional): Filtrar por status
- `startDate` (optional): Data início (ISO 8601)
- `endDate` (optional): Data fim (ISO 8601)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "tx_swap_abc123",
        "type": "crypto_swap",
        "status": "completed",
        "createdAt": "2024-01-15T14:30:45.123Z",
        "fromToken": "USDC",
        "toToken": "BRL",
        "fromAmount": 1000,
        "toAmount": 5208.30,
        "fees": 26.20
      }
    ],
    "pagination": {
      "total": 45,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

## 🏛️ KYC - Verificação de Identidade

### GET /kyc/status
Obter status atual do KYC do usuário.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kyc": {
      "currentLevel": "LEVEL_1",
      "status": "VERIFIED",
      "verifiedAt": "2024-01-15T12:00:00.000Z",
      "limits": {
        "daily": {
          "maximum": 5000.00,
          "used": 2500.00,
          "remaining": 2500.00
        },
        "monthly": {
          "maximum": 50000.00,
          "used": 35000.00,
          "remaining": 15000.00
        }
      },
      "nextLevel": {
        "level": "LEVEL_2",
        "benefits": [
          "Limite diário: R$ 25.000",
          "Limite mensal: R$ 200.000",
          "Acesso a produtos premium"
        ],
        "requirements": [
          "Verificação de documentos",
          "Selfie com documento",
          "Comprovante de renda"
        ]
      },
      "history": [
        {
          "level": "LEVEL_1",
          "status": "VERIFIED",
          "verifiedAt": "2024-01-15T12:00:00.000Z",
          "provider": "internal"
        }
      ]
    }
  }
}
```

### POST /kyc/level1
Submeter dados para KYC Nível 1.

**Request:**
```json
{
  "personalInfo": {
    "fullName": "João da Silva Santos",
    "cpf": "123.456.789-01",
    "dateOfBirth": "1990-05-15",
    "phone": "+5511999887766",
    "address": {
      "street": "Rua das Flores, 123",
      "neighborhood": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01234-567",
      "country": "BR"
    }
  },
  "acceptedTerms": true,
  "consentDataProcessing": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kyc": {
      "level": "LEVEL_1",
      "status": "UNDER_REVIEW",
      "submittedAt": "2024-01-15T14:30:45.123Z",
      "estimatedCompletion": "2024-01-15T18:30:45.123Z",
      "referenceId": "kyc1_abc123"
    }
  }
}
```

### POST /kyc/level2/initiate
Iniciar processo de KYC Nível 2.

**Request:**
```json
{
  "preferredProvider": "jumio" // opcional
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kyc": {
      "level": "LEVEL_2",
      "status": "INITIATED",
      "provider": "jumio",
      "externalSession": {
        "sessionId": "jumio_session_abc123",
        "verificationUrl": "https://netverify.com/v4/initiate?token=abc123...",
        "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
        "expiresAt": "2024-01-15T16:30:45.123Z"
      },
      "referenceId": "kyc2_abc123",
      "instructions": [
        "Clique no link ou escaneie o QR code",
        "Tenha seus documentos em mãos",
        "Certifique-se de estar em local bem iluminado",
        "O processo leva cerca de 5-10 minutos"
      ]
    }
  }
}
```

### GET /kyc/level2/status/:referenceId
Verificar status do KYC Nível 2.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kyc": {
      "level": "LEVEL_2",
      "status": "VERIFIED",
      "referenceId": "kyc2_abc123",
      "provider": "jumio",
      "verifiedAt": "2024-01-15T15:45:22.789Z",
      "verificationData": {
        "documentType": "CNH",
        "documentNumber": "123456789",
        "documentExpiry": "2029-05-15",
        "faceMatch": "MATCH",
        "documentAuthenticity": "AUTHENTIC",
        "riskScore": 15
      },
      "newLimits": {
        "daily": {
          "maximum": 25000.00
        },
        "monthly": {
          "maximum": 200000.00
        }
      }
    }
  }
}
```

### POST /kyc/level3/initiate
Iniciar processo de KYC Nível 3.

**Request:**
```json
{
  "incomeInfo": {
    "monthlyIncome": 15000.00,
    "incomeSource": "employment",
    "employerName": "Tech Company Ltda",
    "profession": "Software Engineer"
  },
  "documents": [
    {
      "type": "income_proof",
      "file": "base64_encoded_file_content",
      "fileName": "comprovante_renda.pdf"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kyc": {
      "level": "LEVEL_3",
      "status": "UNDER_REVIEW",
      "submittedAt": "2024-01-15T14:30:45.123Z",
      "estimatedCompletion": "2024-01-17T14:30:45.123Z",
      "referenceId": "kyc3_abc123",
      "reviewProcess": {
        "steps": [
          "Análise de documentos",
          "Verificação de renda",
          "Análise de compliance",
          "Aprovação final"
        ],
        "currentStep": 1
      }
    }
  }
}
```

### GET /kyc/limits
Obter limites atuais do usuário.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "limits": {
      "kycLevel": "LEVEL_1",
      "daily": {
        "maximum": 5000.00,
        "used": 2500.00,
        "remaining": 2500.00,
        "resetAt": "2024-01-16T00:00:00.000Z"
      },
      "monthly": {
        "maximum": 50000.00,
        "used": 35000.00,
        "remaining": 15000.00,
        "resetAt": "2024-02-01T00:00:00.000Z"
      },
      "perTransaction": {
        "maximum": 2500.00
      },
      "upgradeOptions": [
        {
          "level": "LEVEL_2",
          "dailyLimit": 25000.00,
          "monthlyLimit": 200000.00,
          "requirements": ["Document verification"]
        }
      ]
    }
  }
}
```

---

## 🪙 Tokenomics - Capy Points e Capy Coins

### GET /tokenomics/balances
Obter saldos de tokens do usuário.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "balances": {
      "capyPoints": {
        "current": 1250,
        "pending": 50,
        "total": 1300,
        "lastUpdated": "2024-01-15T14:30:45.123Z"
      },
      "capyCoins": {
        "current": 50.75,
        "pending": 2.25,
        "total": 53.00,
        "lastUpdated": "2024-01-15T14:30:45.123Z",
        "onChainBalance": 48.50, // Saldo confirmado na blockchain
        "custodialBalance": 2.25  // Saldo custodial pendente
      },
      "brcapy": {
        "current": 1000.50,
        "currentValue": 1.05234567, // Valor atual da BRcapy em BRL
        "totalValueBRL": 1052.35,
        "yieldEarned": {
          "daily": 2.85,
          "monthly": 85.50,
          "total": 342.75
        },
        "lastUpdated": "2024-01-15T14:30:45.123Z"
      }
    }
  }
}
```

### GET /tokenomics/capy-points/history
Histórico de Capy Points.

**Query Parameters:**
- `limit` (optional): Limite de resultados (default: 20, max: 100)
- `offset` (optional): Offset para paginação
- `type` (optional): Filtrar por tipo (earned, spent, bonus)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "cp_history_123",
        "type": "earned",
        "amount": 50,
        "reason": "Transaction completion",
        "transactionId": "tx_swap_abc123",
        "createdAt": "2024-01-15T14:30:45.123Z",
        "metadata": {
          "transactionType": "crypto_swap",
          "transactionAmount": 1000
        }
      },
      {
        "id": "cp_history_124",
        "type": "bonus",
        "amount": 100,
        "reason": "Referral bonus",
        "referralId": "ref_xyz789",
        "createdAt": "2024-01-15T12:15:30.456Z"
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### POST /tokenomics/capy-coins/convert
Converter Capy Points em Capy Coins.

**Request:**
```json
{
  "capyPointsAmount": 1000,
  "targetCapyCoins": 10.0 // Opcional, calculado automaticamente se não fornecido
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "conversion": {
      "id": "conversion_abc123",
      "capyPointsUsed": 1000,
      "capyCoinsReceived": 10.0,
      "conversionRate": 100, // 100 points = 1 coin
      "status": "completed",
      "processedAt": "2024-01-15T14:30:45.123Z",
      "newBalances": {
        "capyPoints": 250,
        "capyCoins": 60.75
      }
    }
  }
}
```

### GET /tokenomics/capy-coins/rates
Obter taxas de conversão atuais.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "rates": {
      "pointsToCoins": {
        "rate": 100, // 100 points = 1 coin
        "minimumPoints": 100,
        "maximumPoints": 10000
      },
      "coinsToPoints": {
        "rate": 100, // 1 coin = 100 points
        "minimumCoins": 1,
        "maximumCoins": 100
      },
      "lastUpdated": "2024-01-15T14:30:45.123Z"
    }
  }
}
```

---

## 🐹 BRcapy - Yieldcoin

### GET /brcapy/dashboard
Dashboard completo da BRcapy.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "brcapy": {
      "currentValue": 1.05234567,
      "previousValue": 1.05180234,
      "dailyChange": 0.00054333,
      "dailyChangePercent": 0.0516,
      "apy": 12.85,
      "totalSupply": 50000000.00,
      "marketCap": 52617283.50,
      "userBalance": {
        "amount": 1000.50,
        "valueBRL": 1052.35,
        "yieldEarned": {
          "today": 2.85,
          "thisMonth": 85.50,
          "allTime": 342.75
        }
      },
      "metrics": {
        "cdi": {
          "current": 11.75,
          "source": "B3",
          "lastUpdated": "2024-01-15T10:00:00.000Z"
        },
        "internalFees": 1.10,
        "totalYield": 12.85,
        "poolUtilization": 78.5,
        "reserveRatio": 21.5
      },
      "lastUpdated": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

### GET /brcapy/history
Histórico de valor da BRcapy.

**Query Parameters:**
- `period` (optional): Período (7d, 30d, 90d, 1y, all) - default: 30d
- `interval` (optional): Intervalo (hourly, daily, weekly) - default: daily

**Response (200):**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "date": "2024-01-15",
        "value": 1.05234567,
        "change": 0.00054333,
        "changePercent": 0.0516,
        "apy": 12.85,
        "cdi": 11.75,
        "volume": 125000.00
      },
      {
        "date": "2024-01-14",
        "value": 1.05180234,
        "change": 0.00051122,
        "changePercent": 0.0486,
        "apy": 12.82,
        "cdi": 11.75,
        "volume": 98500.00
      }
    ],
    "summary": {
      "period": "30d",
      "startValue": 1.04123456,
      "endValue": 1.05234567,
      "totalChange": 0.01111111,
      "totalChangePercent": 1.067,
      "averageApy": 12.75,
      "totalVolume": 3750000.00
    }
  }
}
```

### POST /brcapy/distribute
Distribuir BRcapy para usuário (interno).

**Request:**
```json
{
  "amount": 100.00,
  "reason": "Transaction reward",
  "transactionId": "tx_swap_abc123" // Opcional
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "distribution": {
      "id": "dist_abc123",
      "amount": 100.00,
      "reason": "Transaction reward",
      "processedAt": "2024-01-15T14:30:45.123Z",
      "newBalance": 1100.50,
      "currentValue": 1.05234567,
      "valueBRL": 105.23
    }
  }
}
```

### POST /brcapy/redeem
Resgatar BRcapy (conversão para BRL).

**Request:**
```json
{
  "amount": 500.00,
  "destinationDetails": {
    "pixKey": "user@example.com",
    "bankAccount": {
      "bank": "341",
      "agency": "1234",
      "account": "12345-6"
    }
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "redemption": {
      "id": "redeem_abc123",
      "brcapyAmount": 500.00,
      "brlValue": 526.17,
      "exchangeRate": 1.05234567,
      "fees": {
        "platform": 5.26,
        "total": 5.26
      },
      "netAmount": 520.91,
      "status": "processing",
      "estimatedCompletion": "2024-01-15T15:30:45.123Z",
      "newBalance": 500.50
    }
  }
}
```

---

## 👥 Referrals - Programa de Indicação

### GET /referrals/link
Obter link de referência do usuário.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "referral": {
      "code": "CAPY-JOAO-2024",
      "link": "https://capypay.com/ref/CAPY-JOAO-2024",
      "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      "stats": {
        "totalReferrals": 5,
        "activeReferrals": 3,
        "totalRewards": {
          "capyPoints": 500,
          "capyCoins": 25.0,
          "brcapy": 50.0
        },
        "pendingRewards": {
          "capyPoints": 100,
          "capyCoins": 5.0
        }
      },
      "program": {
        "rewards": {
          "referrer": {
            "signup": { "capyPoints": 100 },
            "firstTransaction": { "capyCoins": 5.0 },
            "monthlyActive": { "brcapy": 10.0 }
          },
          "referred": {
            "signup": { "capyPoints": 50 },
            "firstTransaction": { "capyCoins": 2.5 }
          }
        },
        "conditions": [
          "Usuário indicado deve completar KYC Nível 1",
          "Primeira transação mínima de R$ 100",
          "Recompensas processadas em até 48h"
        ]
      }
    }
  }
}
```

### GET /referrals/history
Histórico de indicações.

**Query Parameters:**
- `limit` (optional): Limite de resultados (default: 20)
- `offset` (optional): Offset para paginação
- `status` (optional): Filtrar por status (active, inactive, pending)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "referrals": [
      {
        "id": "ref_abc123",
        "referredUser": {
          "id": "user_referred_123",
          "name": "Maria Silva",
          "joinedAt": "2024-01-10T14:30:45.123Z"
        },
        "status": "active",
        "kycCompleted": true,
        "firstTransactionCompleted": true,
        "firstTransactionAt": "2024-01-11T16:20:30.456Z",
        "totalTransactions": 8,
        "totalVolume": 5000.00,
        "rewardsEarned": {
          "capyPoints": 150,
          "capyCoins": 7.5,
          "brcapy": 20.0
        },
        "lastActivity": "2024-01-15T12:45:22.789Z"
      }
    ],
    "pagination": {
      "total": 5,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### POST /referrals/validate
Validar código de referência (usado durante signup).

**Request:**
```json
{
  "referralCode": "CAPY-JOAO-2024"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "referral": {
      "code": "CAPY-JOAO-2024",
      "isValid": true,
      "referrer": {
        "name": "João Silva",
        "joinedAt": "2023-12-15T10:30:45.123Z"
      },
      "rewards": {
        "signup": { "capyPoints": 50 },
        "firstTransaction": { "capyCoins": 2.5 }
      }
    }
  }
}
```

**Response (404 - Invalid Code):**
```json
{
  "success": false,
  "error": {
    "code": "REFERRAL_NOT_FOUND",
    "message": "Invalid referral code"
  }
}
```

---

## 🔔 Notificações

### POST /notifications/register-frame
Registrar frame/token do MiniKit para notificações.

**Request:**
```json
{
  "frameUrl": "https://t.me/CapyPayBot/app",
  "frameToken": "telegram_frame_token_abc123",
  "deviceInfo": {
    "platform": "telegram",
    "version": "1.0.0",
    "language": "pt-BR"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "registration": {
      "id": "notification_reg_123",
      "status": "active",
      "registeredAt": "2024-01-15T14:30:45.123Z",
      "preferences": {
        "transactionUpdates": true,
        "kycUpdates": true,
        "referralUpdates": true,
        "marketingMessages": false
      }
    }
  }
}
```

### GET /notifications/preferences
Obter preferências de notificação.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "preferences": {
      "transactionUpdates": true,
      "kycUpdates": true,
      "referralUpdates": true,
      "marketingMessages": false,
      "dailySummary": true,
      "weeklyReport": false,
      "channels": {
        "telegram": true,
        "email": false,
        "sms": false
      }
    }
  }
}
```

### PUT /notifications/preferences
Atualizar preferências de notificação.

**Request:**
```json
{
  "transactionUpdates": true,
  "kycUpdates": true,
  "referralUpdates": false,
  "marketingMessages": false,
  "channels": {
    "telegram": true,
    "email": true
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "preferences": {
      "transactionUpdates": true,
      "kycUpdates": true,
      "referralUpdates": false,
      "marketingMessages": false,
      "channels": {
        "telegram": true,
        "email": true
      },
      "updatedAt": "2024-01-15T14:30:45.123Z"
    }
  }
}
```

### GET /notifications/history
Histórico de notificações enviadas.

**Query Parameters:**
- `limit` (optional): Limite de resultados (default: 20)
- `offset` (optional): Offset para paginação
- `type` (optional): Filtrar por tipo
- `status` (optional): Filtrar por status (sent, delivered, failed)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif_abc123",
        "type": "transaction_completed",
        "title": "Transação Concluída",
        "message": "Seu swap de USDC para BRL foi processado com sucesso!",
        "status": "delivered",
        "sentAt": "2024-01-15T14:35:45.123Z",
        "deliveredAt": "2024-01-15T14:35:47.456Z",
        "channel": "telegram",
        "metadata": {
          "transactionId": "tx_swap_abc123",
          "amount": 1000
        }
      }
    ],
    "pagination": {
      "total": 15,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

---

## 🛡️ Admin - Blacklist e Gestão de Fraudes

### GET /admin/blacklist
Listar entradas da blacklist (Admin apenas).

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**
- `type` (optional): Filtrar por tipo (user, wallet, email, ip, phone, document, bank_account)
- `severity` (optional): Filtrar por severidade (low, medium, high, critical)
- `source` (optional): Filtrar por fonte
- `limit` (optional): Limite de resultados (default: 50, max: 1000)
- `offset` (optional): Offset para paginação

**Response (200):**
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "type": "wallet",
        "value": "0x7F36...be1B", // Mascarado
        "reason": "OFAC sanctioned address - Lazarus Group",
        "severity": "critical",
        "source": "ofac",
        "addedAt": "2024-01-15T10:00:00.000Z",
        "addedBy": "system",
        "metadata": {
          "hash": "abc123def456",
          "addedVia": "automated_import"
        }
      }
    ],
    "pagination": {
      "total": 1250,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    },
    "statistics": {
      "total": 1250,
      "byType": {
        "wallet": 800,
        "email": 300,
        "user": 100,
        "ip": 50
      },
      "bySeverity": {
        "critical": 150,
        "high": 300,
        "medium": 600,
        "low": 200
      }
    }
  }
}
```

### POST /admin/blacklist
Adicionar entrada à blacklist (Admin apenas).

**Request:**
```json
{
  "type": "wallet",
  "value": "0x742d35Cc6634C0532925a3b8D404d",
  "reason": "Suspicious activity - multiple fraud reports",
  "severity": "high",
  "source": "manual",
  "metadata": {
    "reportedBy": "user_abc123",
    "incidentId": "incident_456"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "entry": {
      "type": "wallet",
      "value": "0x742d...404d", // Mascarado
      "reason": "Suspicious activity - multiple fraud reports",
      "severity": "high",
      "source": "manual",
      "addedAt": "2024-01-15T14:30:45.123Z",
      "addedBy": "admin_demo",
      "metadata": {
        "hash": "def789ghi012",
        "addedVia": "admin_interface"
      }
    },
    "action": "added"
  }
}
```

### DELETE /admin/blacklist/:type/:value
Remover entrada da blacklist (Admin apenas).

**Request Body:**
```json
{
  "reason": "False positive - verified legitimate user"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "removedEntry": {
      "type": "wallet",
      "value": "0x742d...404d",
      "reason": "Suspicious activity - multiple fraud reports",
      "severity": "high",
      "addedAt": "2024-01-15T14:30:45.123Z"
    },
    "removalReason": "False positive - verified legitimate user",
    "removedBy": "admin_demo",
    "removedAt": "2024-01-15T16:45:22.789Z"
  }
}
```

### POST /admin/blacklist/check
Verificar entidades contra blacklist (Admin apenas).

**Request:**
```json
{
  "entities": [
    {
      "type": "user",
      "value": "user_abc123"
    },
    {
      "type": "wallet", 
      "value": "0x742d35Cc6634C0532925a3b8D404d"
    },
    {
      "type": "email",
      "value": "user@example.com"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "type": "user",
        "value": "user_***123", // Mascarado
        "isBlacklisted": false,
        "isWhitelisted": false
      },
      {
        "type": "wallet",
        "value": "0x742d...404d",
        "isBlacklisted": true,
        "reason": "Suspicious activity - multiple fraud reports",
        "severity": "high",
        "source": "manual",
        "addedAt": "2024-01-15T14:30:45.123Z"
      },
      {
        "type": "email",
        "value": "us***@example.com",
        "isBlacklisted": false,
        "isWhitelisted": false
      }
    ],
    "summary": {
      "total": 3,
      "blacklisted": 1,
      "whitelisted": 0,
      "clean": 2
    }
  }
}
```

### GET /admin/fraud-cases
Listar casos de investigação de fraude (Admin apenas).

**Query Parameters:**
- `status` (optional): Filtrar por status (OPEN, IN_PROGRESS, CLOSED)
- `priority` (optional): Filtrar por prioridade (LOW, MEDIUM, HIGH, CRITICAL)
- `assignedTo` (optional): Filtrar por investigador
- `limit` (optional): Limite de resultados

**Response (200):**
```json
{
  "success": true,
  "data": {
    "cases": [
      {
        "id": "case_abc123",
        "type": "BLACKLIST_CRITICAL",
        "status": "OPEN",
        "priority": "CRITICAL",
        "userId": "user_***456",
        "transactionId": "tx_swap_def789",
        "riskScore": 95,
        "reasons": [
          "Critical blacklist match detected",
          "Wallet address in OFAC sanctions list"
        ],
        "createdAt": "2024-01-15T14:30:45.123Z",
        "assignedTo": null,
        "estimatedResolutionTime": "2024-01-15T18:30:45.123Z"
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

## 📊 Códigos de Erro Padronizados

### Códigos de Status HTTP
```javascript
const httpStatusCodes = {
  // Success
  200: 'OK - Request successful',
  201: 'Created - Resource created successfully',
  202: 'Accepted - Request accepted for processing',
  204: 'No Content - Request successful, no content to return',
  
  // Client Errors
  400: 'Bad Request - Invalid request format or parameters',
  401: 'Unauthorized - Authentication required or invalid',
  403: 'Forbidden - Access denied or insufficient permissions',
  404: 'Not Found - Resource not found',
  409: 'Conflict - Resource already exists or conflict',
  422: 'Unprocessable Entity - Validation failed',
  429: 'Too Many Requests - Rate limit exceeded',
  
  // Server Errors
  500: 'Internal Server Error - Unexpected server error',
  502: 'Bad Gateway - External service error',
  503: 'Service Unavailable - Service temporarily unavailable',
  504: 'Gateway Timeout - External service timeout'
};
```

### Códigos de Erro Customizados
```javascript
const errorCodes = {
  // Autenticação
  INVALID_TOKEN: 'Token de acesso inválido ou expirado',
  TOKEN_EXPIRED: 'Token de acesso expirado',
  REFRESH_TOKEN_INVALID: 'Refresh token inválido',
  LOGIN_BLOCKED: 'Login bloqueado por segurança',
  
  // Validação
  VALIDATION_ERROR: 'Erro de validação nos dados enviados',
  MISSING_REQUIRED_FIELD: 'Campo obrigatório não informado',
  INVALID_FORMAT: 'Formato de dados inválido',
  
  // KYC
  KYC_REQUIRED: 'Verificação KYC necessária',
  KYC_PENDING: 'Verificação KYC em andamento',
  KYC_REJECTED: 'Verificação KYC rejeitada',
  ENHANCED_KYC_REQUIRED: 'KYC aprimorado necessário',
  
  // Transações
  TRANSACTION_BLOCKED: 'Transação bloqueada por segurança',
  INSUFFICIENT_BALANCE: 'Saldo insuficiente',
  LIMIT_EXCEEDED: 'Limite de transação excedido',
  VELOCITY_LIMIT_EXCEEDED: 'Limite de velocidade excedido',
  INVALID_AMOUNT: 'Valor da transação inválido',
  
  // Fraude
  BLACKLIST_CRITICAL: 'Entidade em blacklist crítica',
  FRAUD_DETECTED: 'Atividade fraudulenta detectada',
  REVIEW_REQUIRED: 'Revisão manual necessária',
  
  // Sistema
  EXTERNAL_SERVICE_ERROR: 'Erro em serviço externo',
  RATE_LIMIT_EXCEEDED: 'Limite de requisições excedido',
  MAINTENANCE_MODE: 'Sistema em manutenção',
  
  // Recursos
  RESOURCE_NOT_FOUND: 'Recurso não encontrado',
  RESOURCE_ALREADY_EXISTS: 'Recurso já existe',
  PERMISSION_DENIED: 'Permissão negada',
  
  // Admin
  ADMIN_AUTH_REQUIRED: 'Autenticação de admin necessária',
  INSUFFICIENT_PERMISSIONS: 'Permissões insuficientes'
};
```

### Exemplos de Responses de Erro

**400 - Validation Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "amount",
        "message": "Amount must be greater than 0",
        "value": -100
      },
      {
        "field": "email",
        "message": "Invalid email format",
        "value": "invalid-email"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T14:30:45.123Z",
    "correlationId": "capy_1705327845123_a1b2c3d4"
  }
}
```

**403 - Transaction Blocked:**
```json
{
  "success": false,
  "error": {
    "code": "TRANSACTION_BLOCKED",
    "message": "Transaction blocked due to security concerns",
    "supportReference": "capy_1705327845123_a1b2c3d4"
  },
  "meta": {
    "timestamp": "2024-01-15T14:30:45.123Z",
    "correlationId": "capy_1705327845123_a1b2c3d4"
  }
}
```

**429 - Rate Limit:**
```json
{
  "success": false,
  "error": {
    "code": "VELOCITY_LIMIT_EXCEEDED",
    "message": "Transaction velocity limits exceeded",
    "details": [
      "Transaction frequency: 15/hour (limit: 10)",
      "Hourly volume: R$ 15000 (limit: R$ 10000)"
    ],
    "retryAfter": 3600
  },
  "meta": {
    "timestamp": "2024-01-15T14:30:45.123Z",
    "correlationId": "capy_1705327845123_a1b2c3d4"
  }
}
```

**500 - Internal Server Error:**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "supportReference": "capy_1705327845123_a1b2c3d4"
  },
  "meta": {
    "timestamp": "2024-01-15T14:30:45.123Z",
    "correlationId": "capy_1705327845123_a1b2c3d4"
  }
}
```

---

## 🔒 Considerações de Segurança

### Headers de Segurança
```javascript
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};
```

### Rate Limiting
```javascript
const rateLimits = {
  // Por usuário autenticado
  authenticated: {
    general: '1000 req/hour',
    transactions: '100 req/hour',
    kyc: '10 req/hour',
    admin: '500 req/hour'
  },
  
  // Por IP
  byIP: {
    general: '5000 req/hour',
    auth: '50 req/hour',
    registration: '10 req/hour'
  },
  
  // Endpoints críticos
  critical: {
    '/auth/google-login': '20 req/15min',
    '/core/swap/initiate': '50 req/hour',
    '/kyc/level2/initiate': '5 req/day',
    '/admin/*': '200 req/hour'
  }
};
```

### Validação de Input
```javascript
const inputValidation = {
  sanitization: [
    'HTML encoding para prevenir XSS',
    'SQL injection prevention',
    'NoSQL injection prevention',
    'Path traversal prevention'
  ],
  
  validation: [
    'Schema validation com Joi/Yup',
    'Type checking rigoroso',
    'Range validation para números',
    'Length validation para strings',
    'Format validation (email, CPF, etc.)'
  ],
  
  businessRules: [
    'KYC level requirements',
    'Transaction limits validation',
    'Balance sufficiency checks',
    'Fraud prevention rules'
  ]
};
```

---

## 📝 Documentação OpenAPI/Swagger

A especificação completa está disponível em:
- **Swagger UI**: `https://api.capypay.com/docs`
- **OpenAPI JSON**: `https://api.capypay.com/api-docs.json`
- **Redoc**: `https://api.capypay.com/redoc`

### Exemplo de Definição OpenAPI
```yaml
openapi: 3.0.3
info:
  title: Capy Pay API
  description: API completa para o sistema financeiro Capy Pay
  version: 1.0.0
  contact:
    name: Capy Pay Team
    email: api@capypay.com
  license:
    name: Proprietary
    
servers:
  - url: https://api.capypay.com/api/v1
    description: Production server
  - url: https://api-dev.capypay.com/api/v1
    description: Development server

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          example: "user_abc123"
        email:
          type: string
          format: email
          example: "user@example.com"
        name:
          type: string
          example: "João Silva"
        # ... outros campos
        
security:
  - BearerAuth: []
```

Esta especificação de API fornece uma base sólida para o desenvolvimento do frontend e integração com todos os serviços backend implementados. 