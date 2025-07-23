# 🚀 Guia de Demonstração - Capy Pay Hackathon

## Funcionalidade: Pagamento de Boleto com USDC

### 🎯 O que a Demo Faz
- Usuário tem 1,500 USDC de saldo
- Insere código de barras de boleto (pré-preenchido)
- Sistema analisa e mostra: valor R$ 850, taxa de conversão, USDC necessário
- Usuário confirma e sistema simula pagamento
- Mostra comprovante e novo saldo

---

## 📋 Pré-requisitos
- Node.js 18+ instalado
- npm ou yarn
- 2 terminais abertos

---

## 🔧 Setup Rápido

### **Terminal 1: Backend**
```bash
# Navegar para pasta backend
cd backend

# Instalar dependências (primeira vez)
npm install

# Iniciar servidor backend
npm run dev

# Deve aparecer:
# ✅ Server running on port 3001
# ✅ Demo endpoints available at /api/demo
```

### **Terminal 2: Frontend**
```bash
# Navegar para pasta raiz
cd ..

# Instalar dependências (primeira vez) 
npm install

# Iniciar servidor frontend
npm run dev

# Deve aparecer:
# ✅ Next.js ready on http://localhost:3000
```

---

## 🎬 Fluxo da Demonstração

### **1. Abrir no Navegador**
- Acesse: `http://localhost:3000`
- Deve aparecer o dashboard do Capy Pay

### **2. Iniciar Pagamento**
- Clique no botão **"Pay Bill"**
- Verá saldo: **1,500.00 USDC**

### **3. Código de Barras**
- Campo já vem pré-preenchido com código válido
- Clique em **"Analisar Boleto"**
- Loading de 1.5s (simulando API real)

### **4. Confirmação dos Dados**
- **Beneficiário**: ENEL DISTRIBUIÇÃO GOIÁS
- **Valor**: R$ 850,00
- **Taxa**: 1 USDC = R$ 5,00
- **USDC Necessário**: 172.55 USDC
- Clique em **"Confirmar Pagamento"**

### **5. Processamento**
- Loading de 4s com steps:
  - ✅ Validando boleto
  - ✅ Convertendo USDC → BRL
  - ⏳ Processando pagamento
  - ✅ Pagamento realizado!

### **6. Sucesso**
- ✅ **Pagamento Realizado com Sucesso!**
- ID: #CP24011501
- Novo saldo: **1,327.45 USDC**
- Botões para nova transação

---

## 🔍 Verificação de Funcionamento

### **Backend API**
```bash
# Testar se API está funcionando
curl http://localhost:3001/api/demo/status

# Deve retornar:
{
  "success": true,
  "data": {
    "status": "Demo API Running",
    "endpoints": [...]
  }
}
```

### **Frontend**
- Dashboard carrega sem erros
- Logo da capivara aparece
- Botão "Pay Bill" é clicável
- Transições suaves entre telas

---

## 🐛 Resolução de Problemas

### **Backend não inicia**
```bash
# Verificar se porta 3001 está livre
lsof -ti:3001 | xargs kill -9

# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### **Frontend não conecta com Backend**
```bash
# Verificar se ambos servidores estão rodando
# Backend: http://localhost:3001
# Frontend: http://localhost:3000

# Verificar console do navegador (F12)
# Não deve haver erros CORS
```

### **Componentes não aparecem**
```bash
# Limpar cache do Next.js
rm -rf .next
npm run dev
```

---

## 🎤 Roteiro de Apresentação

### **Intro (30s)**
> "O Capy Pay resolve um problema real: brasileiros com criptomoedas que precisam pagar contas no Brasil. Vou mostrar como transformamos USDC em pagamento de boleto de forma simples."

### **Demo (90s)**
1. **"Aqui temos 1,500 USDC em saldo"** → Clicar Pay Bill
2. **"Usuário cola o código de barras"** → Analisar Boleto  
3. **"Sistema mostra todos os dados transparentes"** → Explicar conversão
4. **"Confirma com um clique"** → Confirmar Pagamento
5. **"Processamento em tempo real"** → Mostrar steps
6. **"Pronto! Boleto pago, saldo atualizado"** → Comprovante

### **Conclusão (30s)**
> "Transformamos a complexidade de usar cripto no Brasil em 3 cliques simples. É isso que o Capy Pay faz: esconde a blockchain, mostra o valor."

---

## 📊 Dados da Demo

### **Usuário Simulado**
- Saldo inicial: 1,500 USDC
- ID: demo_user_123

### **Boleto Simulado**
- Código: 34191790010104351004791020150008291070026000
- Beneficiário: ENEL DISTRIBUIÇÃO GOIÁS
- Valor: R$ 850,00
- Vencimento: 25/01/2024

### **Conversão**
- Taxa: 1 USDC = R$ 5,00
- Taxa de serviço: 1.5%
- USDC necessário: 172.55
- Novo saldo: 1,327.45 USDC

---

## 🏆 Diferencial Competitivo

### **Problema**
- Brasileiros com cripto não conseguem pagar contas facilmente
- Soluções existentes são complexas e técnicas

### **Solução Capy Pay**
- Interface simples como PIX
- Conversão automática e transparente  
- Sem necessidade de conhecimento técnico
- Integração com sistema bancário brasileiro

### **Resultado**
- Adoção massiva de cripto no Brasil
- Bridge entre DeFi e TradFi
- Experiência de usuário superior

---

**🎯 A demonstração está pronta! Basta seguir os passos acima e você terá um fluxo completo funcionando em localhost.** 