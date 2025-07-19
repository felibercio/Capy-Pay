# 🚀 Guia de Implementação - Capy Pay MVP

Este guia detalha os próximos passos para implementar as funcionalidades principais do Capy Pay.

## 🎯 Funcionalidades do MVP

### ✅ Já Implementado
- [x] Estrutura básica do projeto Next.js + TypeScript
- [x] Configuração do Tailwind CSS
- [x] Integração básica com MiniKit (simulada)
- [x] Componentes de UI básicos
- [x] Interface de câmbio
- [x] Interface de pagamentos
- [x] Autenticação com World ID (simulada)

### 🔄 Próximas Implementações

## 1. Integração Real com MiniKit

### 📋 Tarefas
- [ ] Instalar e configurar `@worldcoin/minikit-js`
- [ ] Implementar autenticação real com World ID
- [ ] Configurar verificação de World ID
- [ ] Implementar transações na blockchain

### 🛠️ Implementação

**1.1. Atualizar hook useMiniKit**
```typescript
// src/hooks/useMiniKit.ts
import MiniKit from '@worldcoin/minikit-js';

export function useMiniKit() {
  useEffect(() => {
    MiniKit.init({
      appId: MINIKIT_CONFIG.appId,
    });
  }, []);

  const connect = async () => {
    const result = await MiniKit.walletAuth();
    // Processar resultado real
  };
}
```

**1.2. Implementar verificação World ID**
```typescript
const verify = async () => {
  const result = await MiniKit.verify({
    action: 'payment',
    signal: userAddress,
  });
  return result;
};
```

## 2. Integração com Rede Base

### 📋 Tarefas
- [ ] Configurar Wagmi para rede Base
- [ ] Implementar leitura de saldos de stablecoins
- [ ] Criar funções de transação
- [ ] Implementar aprovação de tokens

### 🛠️ Implementação

**2.1. Configurar Wagmi**
```typescript
// src/lib/wagmi.ts
import { createConfig, http } from 'wagmi';
import { base, baseGoerli } from 'wagmi/chains';

export const config = createConfig({
  chains: [base, baseGoerli],
  transports: {
    [base.id]: http(),
    [baseGoerli.id]: http(),
  },
});
```

**2.2. Hook para saldos**
```typescript
// src/hooks/useTokenBalance.ts
import { useBalance } from 'wagmi';

export function useTokenBalance(tokenAddress: string) {
  return useBalance({
    address: userAddress,
    token: tokenAddress,
  });
}
```

## 3. API de Cotações em Tempo Real

### 📋 Tarefas
- [ ] Integrar API CoinGecko
- [ ] Implementar cache de cotações
- [ ] Criar hook de cotações
- [ ] Atualização automática

### 🛠️ Implementação

**3.1. Service de cotações**
```typescript
// src/lib/exchangeRates.ts
export class ExchangeRateService {
  static async getRates(coins: string[], currencies: string[]) {
    const response = await fetch(`${API_ENDPOINTS.exchangeRates}?ids=${coins.join(',')}&vs_currencies=${currencies.join(',')}`);
    return response.json();
  }
}
```

**3.2. Hook de cotações**
```typescript
// src/hooks/useExchangeRates.ts
export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => ExchangeRateService.getRates(['usd-coin', 'euro-coin'], ['usd', 'eur', 'brl']),
    refetchInterval: 30000, // 30 segundos
  });
}
```

## 4. Sistema de Transações

### 📋 Tarefas
- [ ] Implementar transações de câmbio
- [ ] Criar sistema de aprovação de tokens
- [ ] Implementar histórico de transações
- [ ] Adicionar estados de loading/sucesso/erro

### 🛠️ Implementação

**4.1. Hook de transações**
```typescript
// src/hooks/useTransaction.ts
export function useTransaction() {
  const sendTransaction = async (params: TransactionParams) => {
    // 1. Verificar saldo
    // 2. Aprovar token se necessário
    // 3. Executar transação
    // 4. Aguardar confirmação
  };
}
```

## 5. Sistema de Pagamentos PIX/Boleto

### 📋 Tarefas
- [ ] Integrar API de processamento de pagamentos
- [ ] Implementar validação de chaves PIX
- [ ] Criar sistema de QR Code para PIX
- [ ] Implementar processamento de boletos

### 🛠️ Implementação

**5.1. Service de pagamentos**
```typescript
// src/lib/paymentService.ts
export class PaymentService {
  static async processPixPayment(params: PixPaymentParams) {
    // Integração com API de pagamentos
  }

  static async processBoletoPayment(params: BoletoPaymentParams) {
    // Processamento de boleto
  }
}
```

## 6. Melhorias de UX/UI

### 📋 Tarefas
- [ ] Implementar skeleton loaders
- [ ] Adicionar animações de transição
- [ ] Criar componentes de feedback
- [ ] Implementar modo escuro (opcional)

### 🛠️ Implementação

**6.1. Skeleton Loader**
```typescript
// src/components/ui/Skeleton.tsx
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('loading-shimmer rounded', className)} />
  );
}
```

## 7. Testes e Validação

### 📋 Tarefas
- [ ] Configurar Jest para testes unitários
- [ ] Criar testes para componentes principais
- [ ] Implementar testes de integração
- [ ] Testes no World App

### 🛠️ Implementação

**7.1. Configurar Jest**
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

## 8. Segurança e Validação

### 📋 Tarefas
- [ ] Implementar validação de formulários com Zod
- [ ] Adicionar rate limiting
- [ ] Implementar sanitização de inputs
- [ ] Configurar CSP headers

### 🛠️ Implementação

**8.1. Validação com Zod**
```typescript
// src/lib/validations.ts
import { z } from 'zod';

export const exchangeSchema = z.object({
  amount: z.string().min(1).refine(val => !isNaN(Number(val))),
  fromCoin: z.enum(['USDC', 'EURC', 'BRZ']),
  toCurrency: z.enum(['USD', 'EUR', 'BRL']),
});
```

## 📅 Cronograma Sugerido

### Semana 1: Integração MiniKit + Base
- Configurar MiniKit real
- Implementar Wagmi
- Testes básicos de conectividade

### Semana 2: Cotações + Transações
- API de cotações
- Sistema de transações
- Validações

### Semana 3: Pagamentos
- Integração PIX/Boleto
- Testes de pagamento
- Refinamentos de UX

### Semana 4: Testes + Deploy
- Testes completos
- Deploy no Vercel
- Registro no World App Store

## 🔧 Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Servidor local
npm run tunnel           # ngrok

# Testes
npm run test             # Testes unitários
npm run test:e2e         # Testes E2E

# Build
npm run build            # Build produção
npm run start            # Servidor produção

# Linting
npm run lint             # ESLint
npm run type-check       # TypeScript
```

## 📚 Recursos Adicionais

### Documentações
- [World MiniKit Docs](https://docs.world.org/mini-apps)
- [Base Network Docs](https://docs.base.org)
- [Wagmi Docs](https://wagmi.sh)
- [Next.js Docs](https://nextjs.org/docs)

### APIs Úteis
- [CoinGecko API](https://www.coingecko.com/en/api)
- [Base Block Explorer](https://basescan.org)
- [PIX API Docs](https://www.bcb.gov.br/estabilidadefinanceira/pix)

### Ferramentas de Desenvolvimento
- [ngrok](https://ngrok.com) - Túnel para desenvolvimento
- [Vercel](https://vercel.com) - Deploy
- [Tailwind UI](https://tailwindui.com) - Componentes

---

**📝 Nota**: Este guia deve ser atualizado conforme o progresso da implementação. Cada funcionalidade implementada deve ser marcada como concluída e testada antes de prosseguir para a próxima. 