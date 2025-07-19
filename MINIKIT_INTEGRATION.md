# 🔗 Integração MiniKit - Capy Pay

Este documento detalha a implementação dos hooks e funcionalidades específicas do MiniKit no Capy Pay.

## 🏗️ Estrutura Adaptada

O projeto foi adaptado para seguir o padrão `npx create-onchain --mini` com as seguintes modificações:

### 📁 Estrutura de Arquivos

```
Capy Pay/
├── app/
│   ├── providers.tsx           # MiniKitProvider configurado
│   ├── page.tsx                # Componente principal com hooks
│   └── components/
│       ├── CurrencyConverter.tsx
│       ├── BillPayment.tsx
│       └── WithdrawalOptions.tsx
└── src/
    └── app/
        ├── layout.tsx          # Layout adaptado
        └── globals.css         # Estilos globais
```

## 🎣 Hooks MiniKit Implementados

### 1. useMiniKit
**Localização**: `app/page.tsx`
```typescript
const { isConnected, user } = useMiniKit();
```
**Funcionalidade**: Gerencia estado de conexão e dados do usuário

### 2. useAddFrame
**Localização**: `app/page.tsx`
```typescript
const { addFrame } = useAddFrame();

const handleAddFrame = () => {
  addFrame({
    url: 'https://capy-pay-frame.vercel.app',
    title: 'Capy Pay - Histórico de Transações',
  });
};
```
**Funcionalidade**: Adiciona frame do histórico de transações

### 3. useOpenUrl
**Localização**: `app/page.tsx`
```typescript
const { openUrl } = useOpenUrl();

const handleOpenSupport = () => {
  openUrl('https://docs.capypay.com/support');
};
```
**Funcionalidade**: Abre URLs externas (suporte)

### 4. useViewProfile
**Localização**: `app/page.tsx`
```typescript
const { viewProfile } = useViewProfile();

const handleViewProfile = () => {
  if (user?.walletAddress) {
    viewProfile(user.walletAddress);
  }
};
```
**Funcionalidade**: Visualiza perfil do usuário

### 5. useClose
**Localização**: `app/page.tsx`
```typescript
const { close } = useClose();
```
**Funcionalidade**: Botão "FECHAR" no header

### 6. usePrimaryButton (Estratégico)
**Localização**: `app/page.tsx`
```typescript
usePrimaryButton({
  text: transactionInProgress ? 'Processando...' : 'Confirmar Transação',
  enabled: !transactionInProgress && activeSection !== 'home',
  loading: transactionInProgress,
  onClick: async () => {
    setTransactionInProgress(true);
    
    // Lógica específica baseada na seção ativa
    switch (activeSection) {
      case 'exchange':
        console.log('Processando câmbio...');
        break;
      case 'bills':
        console.log('Processando pagamento de boleto...');
        break;
      case 'withdrawal':
        console.log('Processando saque...');
        break;
    }
    
    setTransactionInProgress(false);
  },
});
```

**Estratégia do Primary Button**:
- **Contexto Global**: Aparece apenas quando há uma transação ativa
- **Estado Dinâmico**: Muda texto e funcionalidade baseado na seção
- **Feedback Visual**: Loading state durante processamento
- **Validação**: Desabilitado na tela inicial

## 🎛️ Gerenciamento de Estado

### Estado Principal
```typescript
type ActiveSection = 'home' | 'exchange' | 'bills' | 'withdrawal';

const [activeSection, setActiveSection] = useState<ActiveSection>('home');
const [transactionInProgress, setTransactionInProgress] = useState(false);
```

### Navegação
- **Home**: Menu principal com cards das funcionalidades
- **Exchange**: Componente CurrencyConverter
- **Bills**: Componente BillPayment  
- **Withdrawal**: Componente WithdrawalOptions

### Estados Condicionais
- Primary button só aparece fora da home
- Header mostra botões de perfil e fechar quando conectado
- Loading states individuais por componente

## 🎨 Componentes Placeholder

### 1. CurrencyConverter
**Arquivo**: `app/components/CurrencyConverter.tsx`

**Funcionalidades**:
- Seleção de stablecoins (USDC, EURC, BRZ)
- Seleção de moedas fiat (USD, EUR, BRL)
- Campo de valor com validação
- Cálculo de taxa de câmbio simulado
- Detalhes da conversão com taxas

**Estados**:
```typescript
const [fromCoin, setFromCoin] = useState<StableCoin>('USDC');
const [toCurrency, setToCurrency] = useState<Currency>('BRL');
const [amount, setAmount] = useState('');
const [isLoading, setIsLoading] = useState(false);
```

### 2. BillPayment
**Arquivo**: `app/components/BillPayment.tsx`

**Funcionalidades**:
- Toggle entre Boleto e PIX
- Validação de código de barras
- Validação de chave PIX
- Simulação de dados do beneficiário
- Resumo do pagamento

**Estados**:
```typescript
const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('boleto');
const [barcode, setBarcode] = useState('');
const [pixKey, setPixKey] = useState('');
const [billDetails, setBillDetails] = useState<any>(null);
```

### 3. WithdrawalOptions
**Arquivo**: `app/components/WithdrawalOptions.tsx`

**Funcionalidades**:
- 4 métodos de saque (PIX, Conta BRL, USD, EUR)
- Formulários específicos por método
- Cálculo de taxas diferenciadas
- Tempo de processamento por método
- Validação de dados bancários

**Estados**:
```typescript
const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod>('pix');
const [amount, setAmount] = useState('');
const [bankDetails, setBankDetails] = useState({...});
```

## ⚙️ Configuração do MiniKitProvider

### Arquivo: `app/providers.tsx`
```typescript
<MiniKitProvider
  apiKey={process.env.NEXT_PUBLIC_APP_ID || ''}
  chain={base}
  appearance={{
    name: 'Capy Pay',
    logo: '🦫',
    description: 'Câmbio e pagamentos internacionais',
    theme: 'light',
    accent: '#0ea5e9',
  }}
  config={{
    enableAnalytics: true,
    enableOnramp: true,
  }}
>
```

### Configurações Específicas:
- **Chain**: Base Network
- **Theme**: Light com accent azul
- **Analytics**: Habilitado
- **Onramp**: Habilitado para facilitar funding

## 🔄 Fluxo de Interação

### 1. Inicialização
1. App carrega com MiniKitProvider
2. Verifica conexão (`isConnected`)
3. Mostra tela de boas-vindas ou menu principal

### 2. Navegação
1. Usuário seleciona funcionalidade no menu
2. Estado `activeSection` muda
3. Primary button aparece e se configura
4. Componente específico é renderizado

### 3. Transação
1. Usuário preenche formulário
2. Clica no Primary button
3. Estado `transactionInProgress` ativa
4. Lógica específica da seção executa
5. Feedback visual e reset do estado

### 4. Ações Auxiliares
- **Add Frame**: Adiciona histórico como frame
- **View Profile**: Abre perfil da wallet
- **Open Support**: Abre documentação externa
- **Close**: Fecha o mini app

## 🚀 Próximos Passos

### Integração Real
1. **Substituir simulações** por chamadas reais do MiniKit
2. **Implementar transações** na blockchain Base
3. **Conectar APIs** de cotação e pagamento
4. **Adicionar World ID** verification

### Melhorias UX
1. **Animações** entre seções
2. **Skeleton loaders** durante carregamento
3. **Notificações** de sucesso/erro
4. **Histórico** de transações

### Funcionalidades Avançadas
1. **Frames personalizados** para diferentes visualizações
2. **Deep linking** para ações específicas
3. **Push notifications** para status de transações
4. **Sharing** de transações

---

**📝 Nota**: Esta estrutura está pronta para desenvolvimento. Todos os hooks estão implementados como placeholders funcionais que podem ser facilmente substituídos pela lógica real conforme a integração com APIs e contratos inteligentes progride. 