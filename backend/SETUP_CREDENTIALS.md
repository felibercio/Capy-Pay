# 🔐 Configuração de Credenciais - Capy Pay Backend

Este guia detalha como configurar as credenciais do StarkBank de forma segura para o backend do Capy Pay.

## 🏦 StarkBank - Configuração Passo a Passo

### 1. Criação de Conta StarkBank

#### 1.1. Ambiente Sandbox (Desenvolvimento)
1. Acesse: [https://web.sandbox.starkbank.com/](https://web.sandbox.starkbank.com/)
2. Clique em **"Criar conta"**
3. Preencha os dados da empresa
4. Confirme o e-mail
5. Complete o onboarding

#### 1.2. Ambiente Produção
1. Acesse: [https://web.starkbank.com/](https://web.starkbank.com/)
2. Siga o processo de KYC completo
3. Aguarde aprovação da conta

### 2. Geração de Chave Privada

#### 2.1. Via Dashboard StarkBank
1. **Login** no dashboard
2. Navegue para **"Configurações"** → **"Chaves"**
3. Clique em **"Gerar Nova Chave"**
4. **Baixe** o arquivo `.pem` gerado
5. **Anote o Project ID** exibido

#### 2.2. Via OpenSSL (Alternativo)
```bash
# Gerar chave privada EC
openssl ecparam -genkey -name secp256k1 -noout -out starkbank-private-key.pem

# Extrair chave pública
openssl ec -in starkbank-private-key.pem -pubout -out starkbank-public-key.pem

# Visualizar chave pública (para registrar no StarkBank)
cat starkbank-public-key.pem
```

### 3. Configuração no Projeto

#### 3.1. Estrutura de Diretórios
```bash
backend/
├── keys/                    # Diretório para chaves (não versionado)
│   └── starkbank-private-key.pem
├── .env                     # Variáveis de ambiente
└── src/
```

#### 3.2. Salvar Chave Privada
```bash
# Criar diretório para chaves
mkdir -p backend/keys

# Copiar arquivo baixado do StarkBank
cp ~/Downloads/starkbank-private-key.pem backend/keys/

# Definir permissões seguras (somente leitura para o proprietário)
chmod 600 backend/keys/starkbank-private-key.pem
```

#### 3.3. Configurar Variáveis de Ambiente
```bash
# Editar arquivo .env
nano backend/.env
```

**Conteúdo do .env:**
```env
# StarkBank Configuration
STARKBANK_PROJECT_ID=5656565656565656
STARKBANK_PRIVATE_KEY_PATH=./keys/starkbank-private-key.pem
STARKBANK_ENVIRONMENT=sandbox

# Webhook Configuration
WEBHOOK_BASE_URL=https://your-backend-domain.com
WEBHOOK_SECRET=your_webhook_secret_key_here

# Server Configuration
PORT=3001
NODE_ENV=development
API_KEY=your_api_key_here
```

### 4. Configuração de Webhook

#### 4.1. URL do Webhook
- **Desenvolvimento**: Use ngrok ou similar
- **Produção**: URL do seu servidor

#### 4.2. Configurar via API (Recomendado)
```bash
# Iniciar servidor
npm run dev

# Configurar webhook via endpoint
curl -X POST http://localhost:3001/api/starkbank/webhook/setup \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/api/starkbank/webhook"
  }'
```

#### 4.3. Configurar via Dashboard
1. **Login** no StarkBank Dashboard
2. Navegue para **"Integrações"** → **"Webhooks"**
3. Clique em **"Novo Webhook"**
4. Configure:
   - **URL**: `https://your-domain.com/api/starkbank/webhook`
   - **Eventos**: `dynamic-brcode`, `boleto-payment`, `deposit`
5. **Salve** a configuração

### 5. Validação da Configuração

#### 5.1. Teste de Conexão
```bash
# Iniciar servidor
npm run dev

# Verificar health check
curl http://localhost:3001/health

# Resposta esperada:
{
  "status": "OK",
  "services": {
    "starkbank": "configured"
  }
}
```

#### 5.2. Teste de PIX
```bash
# Gerar PIX de teste
curl -X POST http://localhost:3001/api/payments/pix/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "amount": 10.50,
    "description": "Teste PIX",
    "userId": "test_user"
  }'
```

## 🔒 Segurança das Credenciais

### Boas Práticas

#### ✅ **FAÇA**
- Use variáveis de ambiente para credenciais
- Mantenha chaves privadas fora do controle de versão
- Use permissões restritivas nos arquivos de chave (600)
- Rotacione chaves periodicamente
- Use ambientes separados (dev/prod)
- Monitore logs de acesso

#### ❌ **NÃO FAÇA**
- Commitar chaves privadas no Git
- Compartilhar credenciais via e-mail/chat
- Usar mesmas credenciais em dev/prod
- Deixar chaves em diretórios públicos
- Usar credenciais hardcoded no código

### Estrutura de Segurança

#### Desenvolvimento
```env
STARKBANK_PROJECT_ID=sandbox_project_id
STARKBANK_ENVIRONMENT=sandbox
WEBHOOK_BASE_URL=https://dev-tunnel.ngrok.io
```

#### Produção
```env
STARKBANK_PROJECT_ID=production_project_id
STARKBANK_ENVIRONMENT=production
WEBHOOK_BASE_URL=https://api.capypay.com
```

## 🚀 Deploy em Produção

### Railway
```bash
# Configurar variáveis de ambiente
railway variables set STARKBANK_PROJECT_ID=your_prod_project_id
railway variables set STARKBANK_ENVIRONMENT=production
railway variables set WEBHOOK_BASE_URL=https://your-app.railway.app

# Upload da chave privada (método seguro)
railway volumes create keys
railway run bash -c "echo 'PRIVATE_KEY_CONTENT' > /app/keys/starkbank-private-key.pem"
```

### Heroku
```bash
# Configurar variáveis
heroku config:set STARKBANK_PROJECT_ID=your_prod_project_id
heroku config:set STARKBANK_ENVIRONMENT=production

# Para chave privada, use buildpack ou addon de secrets
```

### AWS/Google Cloud
- Use **AWS Secrets Manager** ou **Google Secret Manager**
- Configure IAM roles apropriadas
- Implemente rotação automática de chaves

## 🔧 Troubleshooting

### Erro: "StarkBank credentials not configured"
```bash
# Verificar variáveis
echo $STARKBANK_PROJECT_ID
echo $STARKBANK_PRIVATE_KEY_PATH

# Verificar arquivo de chave
ls -la keys/
cat keys/starkbank-private-key.pem
```

### Erro: "Invalid private key format"
```bash
# Verificar formato da chave
openssl ec -in keys/starkbank-private-key.pem -text -noout
```

### Erro: "Webhook signature validation failed"
```bash
# Verificar secret do webhook
echo $WEBHOOK_SECRET

# Testar endpoint
curl http://localhost:3001/api/starkbank/webhook/test
```

### Erro: "Project not found"
```bash
# Verificar Project ID no dashboard StarkBank
# Confirmar ambiente (sandbox vs production)
```

## 📞 Suporte

### StarkBank
- **Documentação**: [https://starkbank.com/docs](https://starkbank.com/docs)
- **Suporte**: suporte@starkbank.com
- **Discord**: [StarkBank Community](https://discord.gg/starkbank)

### Capy Pay
- **Issues**: GitHub Issues
- **E-mail**: dev@capypay.com

---

## ⚠️ Avisos Importantes

1. **NUNCA** commite chaves privadas no Git
2. **SEMPRE** use ambientes separados para dev/prod
3. **MONITORE** logs de acesso às credenciais
4. **ROTACIONE** chaves periodicamente
5. **TESTE** configurações em ambiente seguro primeiro

---

**🔐 Lembre-se: A segurança das credenciais é fundamental para o funcionamento seguro do Capy Pay!** 