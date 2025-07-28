# 🦫 Capy Pay

**Mini app de câmbio e pagamentos internacionais para a rede Base**

Capy Pay é um Mini App desenvolvido para o ecossistema World que permite aos usuários:
- Converter stablecoins (USDC, EURC, BRZ) para moedas fiat (USD, EUR, BRL)
- Pagar boletos e PIX no Brasil usando criptomoedas
- Experiência simplificada que "esconde" a complexidade da blockchain

## 🚀 Tecnologias

- **Next.js 14** - Framework React
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização
- **MiniKit** - Integração com Base App
- **Base Network** - Blockchain Layer 2
- **Wagmi** - Biblioteca Web3 para React

## 📱 Funcionalidades

### Câmbio
- Conversão de stablecoins para moedas fiat
- Cotações em tempo real
- Taxas transparentes
- Histórico de transações

### Pagamentos
- Pagamento de boletos brasileiros
- Transferências PIX
- Múltiplas stablecoins suportadas
- Confirmação instantânea

## 🛠️ Configuração do Ambiente

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- Conta no World App (para testes)
- ngrok (para desenvolvimento local)

### Instalação

1. **Clone o repositório**
```bash
git clone <repository-url>
cd capy-pay
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp env.example .env.local
```

Edite o arquivo `.env.local` com suas configurações:
```env
NEXT_PUBLIC_APP_ID=your_world_app_id
NGROK_DOMAIN=your-domain.ngrok-free.app
```

4. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

5. **Configure o ngrok (em outro terminal)**
```bash
npm run tunnel
```

## 🌐 Desenvolvimento com MiniKit

### Estrutura do Projeto
```
src/
├── app/                 # App Router (Next.js 14)
├── components/          # Componentes React
│   ├── ui/             # Componentes de UI
│   ├── layout/         # Layout components
│   ├── wallet/         # Wallet components
│   ├── exchange/       # Exchange components
│   └── payment/        # Payment components
├── hooks/              # Custom hooks
├── lib/                # Utilities e configurações
├── types/              # Tipos TypeScript
├── constants/          # Constantes da aplicação
└── utils/              # Funções utilitárias
```

### Integração com World App

1. **Configuração do MiniKit**
```typescript
// hooks/useMiniKit.ts
import { MiniKit } from '@worldcoin/minikit-js';

const miniKit = MiniKit.init({
  appId: process.env.NEXT_PUBLIC_APP_ID,
});
```

2. **Autenticação**
```typescript
const { user } = await miniKit.walletAuth();
```

3. **Transações**
```typescript
const result = await miniKit.sendTransaction({
  to: contractAddress,
  value: amount,
  data: encodedData,
});
```

## 🔧 Scripts Disponíveis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build para produção
npm run start        # Servidor de produção
npm run lint         # Verificar código
npm run type-check   # Verificar tipos TypeScript
npm run tunnel       # Iniciar ngrok
```

## 📦 Stablecoins Suportadas

| Coin | Network | Contract Address |
|------|---------|------------------|
| USDC | Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| EURC | Base | `0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42` |
| BRZ  | Base | `0x420000000000000000000000000000000000000A` |

## 🎨 Design System

### Cores
- **Primary**: `#0ea5e9` (Sky Blue)
- **USDC**: `#2775ca`
- **EURC**: `#1e40af`
- **BRZ**: `#16a34a`

### Componentes
- Botões com bordas arredondadas (rounded-xl)
- Cards com sombra sutil
- Inputs com foco em acessibilidade
- Animações suaves

## 🔐 Segurança

- Validação de entrada em todos os formulários
- Sanitização de dados
- Conexão segura
- Transações assinadas na blockchain


```

### Configurações de Produção
- Configure as variáveis de ambiente no Vercel
- Atualize os contratos para mainnet
- Configure domínio personalizado

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📞 Suporte

Para dúvidas ou suporte, abra uma issue no GitHub ou entre em contato:
- Email: dev@capypay.com // felipearcega@gmail.com

---
