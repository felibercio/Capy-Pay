# 🦫 Capy Pay Backend

Backend service para o Capy Pay - Mini app de câmbio e pagamentos internacionais integrado com StarkBank.

## 🏗️ Arquitetura

### Stack Tecnológico
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **StarkBank SDK** - Integração com API de pagamentos
- **ethers.js v6** - Interação com blockchain Base
- **1inch API v6** - Agregador DEX para swaps
- **Winston** - Sistema de logging
- **JWT** - Autenticação
- **Express Validator** - Validação de dados
- **BigNumber.js** - Cálculos precisos com tokens

### Estrutura do Projeto
```
backend/
├── src/
│   ├── server.js                     # Servidor principal
│   ├── services/
│   │   ├── StarkBankService.js       # Serviço StarkBank
│   │   ├── BlockchainMonitorService.js # Monitoramento blockchain
│   │   ├── SwapService.js            # Swaps via 1inch
│   │   └── IntegrationService.js     # Orquestração completa
│   ├── routes/
│   │   ├── payments.js               # Rotas de pagamentos
│   │   ├── blockchain.js             # Rotas blockchain
│   │   ├── webhooks.js               # Rotas de webhooks
│   │   └── health.js                 # Health checks
│   ├── middleware/
│   │   ├── auth.js                   # Autenticação
│   │   └── errorHandler.js           # Tratamento de erros
│   ├── scripts/
│   │   └── initializeServices.js     # Inicialização automática
│   └── utils/
│       └── logger.js                 # Sistema de logs
├── keys/                             # Chaves StarkBank (não versionado)
├── logs/                             # Arquivos de log
├── package.json
├── env.example                       # Exemplo de variáveis de ambiente
├── BLOCKCHAIN_INTEGRATION.md         # Documentação blockchain
└── SETUP_CREDENTIALS.md              # Guia de credenciais
```

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- Conta StarkBank (sandbox/produção)
- Chave privada StarkBank

### 1. Instalação
```bash
cd backend
npm install
```

### 2. Configuração de Ambiente
```bash
# Copiar arquivo de exemplo
cp env.example .env

# Editar variáveis de ambiente
nano .env
```

### 3. Configuração StarkBank

#### 3.1. Obter Credenciais
1. Acesse [StarkBank Dashboard](https://web.sandbox.starkbank.com/)
2. Crie um projeto
3. Gere uma chave privada
4. Anote o Project ID

#### 3.2. Configurar Chave Privada
```bash
# Criar diretório para chaves
mkdir keys

# Salvar chave privada (exemplo)
echo "-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIBEcuGvGcVVdowzw...
-----END EC PRIVATE KEY-----" > keys/starkbank-private-key.pem
```

#### 3.3. Variáveis Essenciais
```env
# StarkBank Configuration
STARKBANK_PROJECT_ID=5656565656565656
STARKBANK_PRIVATE_KEY_PATH=./keys/starkbank-private-key.pem
STARKBANK_ENVIRONMENT=sandbox

# Webhook Configuration
WEBHOOK_BASE_URL=https://your-backend-domain.com
WEBHOOK_SECRET=your_webhook_secret_key_here
```

### 4. Inicialização
```bash
# Desenvolvimento (servidor + blockchain)
npm run dev

# Inicializar apenas serviços blockchain
npm run blockchain:init

# Verificar status dos serviços
npm run blockchain:status

# Testar conectividade blockchain
npm run blockchain:test

# Produção
npm start
```

## 📡 API Endpoints

### Base URL
- **Desenvolvimento**: `http://localhost:3001`
- **Produção**: `https://api.capypay.com`

### Autenticação
Todas as rotas `/api/payments` requerem API Key no header:
```
X-API-Key: your_api_key_here
```

### 1. Health Check
```http
GET /health
```

**Resposta:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "services": {
    "starkbank": "operational",
    "database": "not_configured"
  }
}
```

### 2. Gerar PIX QR Code
```http
POST /api/payments/pix/generate
Content-Type: application/json
X-API-Key: your_api_key

{
  "amount": 100.50,
  "description": "Depósito Capy Pay",
  "userId": "user_123"
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "PIX QR Code generated successfully",
  "data": {
    "id": "5729405850615808",
    "externalId": "capy-user_123-uuid",
    "qrCode": "00020101021226860014br.gov.bcb.pix...",
    "qrCodeImage": "data:image/png;base64,iVBORw0KGgoAAAA...",
    "amount": 10050,
    "description": "Depósito Capy Pay",
    "expiresAt": "2024-01-15T11:30:00.000Z",
    "status": "pending"
  }
}
```

### 3. Pagar Boleto
```http
POST /api/payments/bill/pay
Content-Type: application/json
X-API-Key: your_api_key

{
  "barcode": "34191790010104351004791020150008291070026000",
  "amount": 156.78,
  "userId": "user_123"
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Bill payment processed successfully",
  "data": {
    "id": "5729405850615809",
    "amount": 15678,
    "fee": 250,
    "status": "created",
    "description": "Pagamento de boleto via Capy Pay",
    "scheduledDate": "2024-01-16",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 4. Consultar Transação
```http
GET /api/payments/transaction/5729405850615808
X-API-Key: your_api_key
```

### 5. Webhook StarkBank
```http
POST /api/starkbank/webhook
Content-Type: application/json
Digital-Signature: sha256_signature

{
  "subscription": "dynamic-brcode",
  "id": "event_id",
  "log": {
    "type": "credited",
    "brcode": {
      "id": "5729405850615808",
      "amount": 10050,
      "externalId": "capy-user_123-uuid"
    }
  }
}
```

## 🔧 StarkBankService - Métodos Principais

### `generatePixQrCode(value, description, userId)`
Gera um QR Code PIX dinâmico para recebimento.

**Parâmetros:**
- `value` (number): Valor em centavos
- `description` (string): Descrição do pagamento
- `userId` (string): ID do usuário

**Retorno:**
```javascript
{
  success: true,
  data: {
    id: "starkbank_id",
    qrCode: "pix_code",
    qrCodeImage: "base64_image",
    amount: 10050,
    expiresAt: Date
  }
}
```

### `payBill(barcode, amount, userId)`
Processa pagamento de boleto.

**Parâmetros:**
- `barcode` (string): Código de barras do boleto
- `amount` (number): Valor em centavos
- `userId` (string): ID do usuário

### `setupWebhook(url)`
Configura webhook no StarkBank.

**Parâmetros:**
- `url` (string): URL do webhook

### `handleWebhookEvent(eventData)`
Processa eventos recebidos via webhook.

**Eventos Suportados:**
- `dynamic-brcode` - PIX recebido
- `boleto-payment` - Status de pagamento de boleto
- `deposit` - Depósitos diversos

## 🗄️ Persistência de Dados

### Modelo de Dados (Placeholder)

#### Transação PIX
```javascript
{
  id: "starkbank_id",
  externalId: "capy-user_123-uuid",
  userId: "user_123",
  amount: 10050, // em centavos
  description: "Depósito Capy Pay",
  status: "pending", // pending, completed, expired
  qrCode: "pix_code",
  pixKey: "pix_key",
  expiresAt: Date,
  createdAt: Date,
  completedAt: Date,
  type: "pix_deposit"
}
```

#### Pagamento de Boleto
```javascript
{
  id: "starkbank_id",
  userId: "user_123",
  amount: 15678, // em centavos
  barcode: "34191790010104351004791020150008291070026000",
  description: "Pagamento de boleto",
  status: "created", // created, processing, success, failed
  fee: 250,
  scheduledDate: "2024-01-16",
  createdAt: Date,
  type: "bill_payment"
}
```

### Implementação Futura
```javascript
// TODO: Implementar com PostgreSQL
// TODO: Adicionar Redis para cache
// TODO: Implementar migrations
// TODO: Adicionar índices otimizados
```

## 🔐 Segurança

### Configurações Implementadas
- **Helmet.js** - Headers de segurança
- **CORS** - Controle de origem
- **Rate Limiting** - Limite de requisições
- **API Key** - Autenticação simples
- **JWT** - Tokens de sessão
- **Webhook Signature** - Validação de webhooks

### Variáveis Sensíveis
```env
# NUNCA commitar estas variáveis
STARKBANK_PRIVATE_KEY_PATH=./keys/starkbank-private-key.pem
WEBHOOK_SECRET=your_webhook_secret
JWT_SECRET=your_jwt_secret
API_KEY=your_api_key
```

## 📊 Logging e Monitoramento

### Níveis de Log
- **error** - Erros críticos
- **warn** - Avisos importantes
- **info** - Informações gerais
- **debug** - Debugging detalhado

### Estrutura de Logs
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "PIX generation request",
  "service": "capy-pay-backend",
  "userId": "user_123",
  "amount": 10050,
  "ip": "192.168.1.1"
}
```

### Arquivos de Log
- `logs/error.log` - Apenas erros
- `logs/combined.log` - Todos os logs
- Console - Desenvolvimento

## 🧪 Testes

### Executar Testes
```bash
# Testes unitários
npm test

# Testes com coverage
npm run test:coverage

# Testes de integração
npm run test:integration
```

### Estrutura de Testes (TODO)
```
tests/
├── unit/
│   ├── services/
│   │   └── StarkBankService.test.js
│   └── routes/
│       └── payments.test.js
├── integration/
│   └── api.test.js
└── fixtures/
    └── starkbank-responses.json
```

## 🚀 Deploy

### Ambiente de Produção
1. **Configurar variáveis de ambiente**
2. **Configurar chave privada StarkBank**
3. **Configurar webhook URL**
4. **Deploy na plataforma escolhida**

### Plataformas Suportadas
- **Railway** - Recomendado
- **Heroku** - Alternativa
- **AWS EC2** - Para maior controle
- **Google Cloud Run** - Serverless

### Exemplo Railway
```bash
# Instalar CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway up
```

## 🔄 Webhooks StarkBank

### Configuração
1. **Configurar URL do webhook**
2. **Definir secret para validação**
3. **Implementar processamento de eventos**

### Eventos Principais
```javascript
// PIX recebido
{
  "subscription": "dynamic-brcode",
  "log": {
    "type": "credited",
    "brcode": { /* dados do PIX */ }
  }
}

// Status de pagamento de boleto
{
  "subscription": "boleto-payment",
  "log": {
    "type": "processing",
    "payment": { /* dados do pagamento */ }
  }
}
```

## 📚 Recursos Adicionais

### Documentação
- [StarkBank API Docs](https://starkbank.com/docs)
- [Express.js Guide](https://expressjs.com/)
- [Winston Logger](https://github.com/winstonjs/winston)

### Ferramentas de Desenvolvimento
- **Postman Collection** - [Download](./docs/postman-collection.json)
- **Insomnia Workspace** - [Download](./docs/insomnia-workspace.json)

### Monitoramento
- **Health Checks** - `/health` e `/health/detailed`
- **Logs Estruturados** - Winston + JSON
- **Métricas** - TODO: Implementar Prometheus

---

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](../LICENSE) para mais detalhes.

---

**Desenvolvido com ❤️ para o ecossistema Capy Pay** 