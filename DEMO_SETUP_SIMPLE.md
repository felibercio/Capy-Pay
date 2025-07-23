# 🚀 Setup Rápido - Demo Capy Pay (Servidor Simplificado)

## 🎯 Demonstração: Pagamento de Boleto com USDC

### O que você verá:
1. **Saldo**: 1,500 USDC disponível
2. **Boleto**: ENEL R$ 850,00 
3. **Conversão**: Taxa 1 USDC = R$ 5,00
4. **Pagamento**: Simulação completa em 4 segundos
5. **Comprovante**: Novo saldo 1,327.45 USDC

---

## ⚡ Setup Ultra Rápido (2 comandos)

### **Terminal 1: Backend Simplificado**
```bash
# Entrar na pasta backend
cd backend

# Instalar dependências (só na primeira vez)
npm install

# Rodar servidor demo simplificado
npm run demo

# ✅ Deve aparecer:
# 🚀 [BACKEND] Servidor backend mockado rodando em http://localhost:3001
# ✅ [BACKEND] Pronto para demonstração!
```

### **Terminal 2: Frontend**
```bash
# Voltar para raiz do projeto
cd ..

# Instalar dependências (só na primeira vez)
npm install

# Rodar frontend
npm run dev

# ✅ Deve aparecer:
# ✅ Next.js ready on http://localhost:3000
```

---

## 🎬 Demonstração (90 segundos)

### **1. Abrir Aplicação**
- Navegador: `http://localhost:3000`
- **Página carrega diretamente na tela de pagamento**
- Ver título "Capy Pay - Demonstração"

### **2. Tela de Pagamento**
- **Página já carrega diretamente a tela de pagamento**
- Saldo aparece automaticamente: **1,500.00 USDC**
- Campo código de barras pré-preenchido
- Clicar **"Analisar Boleto"**

### **3. Loading Realista** 
- 1.5s analisando boleto
- Logo da capivara animada

### **4. Dados do Boleto**
- **ENEL DISTRIBUIÇÃO GOIÁS**
- **R$ 850,00** (vencimento 25/01/2024)
- **Taxa**: 1 USDC = R$ 5,00
- **USDC necessário**: 172.55 (com taxa 1.5%)
- Clicar **"Confirmar Pagamento"**

### **5. Processamento** 
- 4s com steps animados:
  - ✅ Validando boleto
  - ✅ Convertendo USDC → BRL
  - ⏳ Processando pagamento
  - ✅ Pagamento realizado!

### **6. Sucesso**
- ✅ **Pagamento Realizado!**
- ID: #CP24011501
- **Novo saldo**: 1,327.45 USDC
- Comprovante completo

---

## 🔍 Teste Rápido

### Verificar Backend
```bash
# Testar se API está funcionando
curl http://localhost:3001/api/demo/status

# Deve retornar JSON com status "Demo API Running"
```

### Verificar Frontend
- Página de pagamento carrega diretamente
- Título "Capy Pay" aparece
- Saldo USDC carrega automaticamente
- Console do navegador (F12) sem erros CORS

---

## 🐛 Problemas Comuns

### **Porta 3001 ocupada**
```bash
# Matar processo na porta 3001
lsof -ti:3001 | xargs kill -9

# Rodar novamente
npm run demo
```

### **Frontend não conecta**
```bash
# Verificar se ambos estão rodando:
# Backend: http://localhost:3001 ✅
# Frontend: http://localhost:3000 ✅

# Limpar cache Next.js se necessário
rm -rf .next
npm run dev
```

### **Dependências**
```bash
# Se der erro de dependências
cd backend
rm -rf node_modules package-lock.json
npm install
```

---

## 🎤 Roteiro de Apresentação

### **Abertura (20s)**
> "Vou mostrar como o Capy Pay resolve um problema real: transformar USDC em pagamento de boleto no Brasil de forma simples."

### **Demonstração (70s)**
1. **"Aqui está o Capy Pay"** → Mostrar página carregada
2. **"Usuário tem 1,500 USDC"** → Mostrar saldo
3. **"Cola o código de barras"** → Analisar Boleto
4. **"Sistema mostra tudo transparente"** → ENEL R$ 850
5. **"Conversão automática clara"** → 172.55 USDC
6. **"Um clique para confirmar"** → Processar
7. **"Pronto! Boleto pago"** → Comprovante

### **Fechamento (20s)**
> "3 cliques. USDC virou pagamento de conta. Isso é o Capy Pay: blockchain invisível, valor visível."

---

## 📊 Dados da Demo

- **Usuário**: demo_user_123
- **Saldo inicial**: 1,500 USDC  
- **Boleto**: ENEL R$ 850,00
- **Taxa**: 1 USDC = R$ 5,00 + 1.5% fee
- **USDC usado**: 172.55
- **Novo saldo**: 1,327.45 USDC

---

## 🏆 Mensagem Principal

**"Capy Pay transforma a complexidade de usar cripto no Brasil em uma experiência simples como PIX"**

### Antes: 
- Ir para exchange
- Vender cripto por reais  
- Transferir para banco
- Pagar boleto

### Depois:
- Abrir Capy Pay
- Colar código de barras
- Confirmar

**4 passos → 3 cliques**

---

**🎯 Demo pronta! Execute os comandos acima e tenha uma apresentação perfeita em localhost.** 