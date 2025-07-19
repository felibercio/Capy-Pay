# 🐹 Capy Pay - MiniApp Frontend

Um mini app moderno e intuitivo para pagamentos com criptomoedas, construído com Next.js, React e MiniKit da Worldcoin.

## 🎨 Design

Este projeto segue fielmente o design apresentado na imagem de referência, com:
- **Cores**: Teal/verde água para backgrounds, marrom/dourado para botões primários
- **Layout**: Cards arredondados com sombras suaves
- **Tipografia**: Inter font para legibilidade otimizada
- **UX**: Mobile-first, touch-friendly, navegação intuitiva

## 🚀 Tecnologias

- **Next.js 14** - Framework React com App Router
- **React 18** - Biblioteca de UI com hooks modernos
- **TypeScript** - Tipagem estática para maior segurança
- **Tailwind CSS** - Framework CSS utility-first
- **MiniKit JS** - SDK da Worldcoin para integração nativa
- **clsx & tailwind-merge** - Utilitários para classes CSS condicionais

## 📱 Funcionalidades

### Telas Implementadas
- **🏠 Home/Dashboard**: Saldo, botões principais, navegação inferior
- **🔄 Swap**: Troca de tokens com seleção de moedas
- **💳 Pay Bill**: Pagamento de boletos com visualização de saldo
- **📊 Transactions**: Visualização de Capy Points e Capy Coins
- **🔗 Referral**: Link de referência com funcionalidade de cópia
- **⭐ Points**: Detalhes dos pontos e moedas do usuário

### Integração MiniKit
- **usePrimaryButton**: Botão principal contextual por tela
- **useClose**: Fechamento nativo do frame
- **useAddFrame**: Adição do app ao World App
- **useViewProfile**: Visualização do perfil do usuário
- **useOpenUrl**: Navegação externa quando necessário

## 🛠️ Setup de Desenvolvimento

### Pré-requisitos
- Node.js 18+ 
- npm 8+
- Git

### Instalação

```bash
# Clone o repositório
git clone <repository-url>
cd capy-pay-frontend

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env.local
```

### Variáveis de Ambiente

```env
# .env.local
NEXT_PUBLIC_MINIKIT_APP_ID=your_minikit_app_id
NEXT_PUBLIC_MINIKIT_SIGNING_KEY=your_minikit_signing_key
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
```

### Desenvolvimento

```bash
# Inicie o servidor de desenvolvimento
npm run dev

# Abra http://localhost:3000 no navegador
```

### Build para Produção

```bash
# Crie o build otimizado
npm run build

# Inicie o servidor de produção
npm start
```

## 📁 Estrutura do Projeto

```
frontend/
├── app/                    # App Router do Next.js
│   ├── globals.css        # Estilos globais
│   ├── layout.tsx         # Layout principal
│   ├── page.tsx           # Página principal com roteamento
│   └── providers.tsx      # Providers (MiniKit, etc.)
├── components/            # Componentes reutilizáveis
│   ├── screens/          # Componentes de tela
│   │   ├── HomeScreen.tsx
│   │   ├── SwapScreen.tsx
│   │   ├── PayBillScreen.tsx
│   │   ├── TransactionsScreen.tsx
│   │   ├── ReferralScreen.tsx
│   │   └── PointsScreen.tsx
│   ├── Button.tsx        # Componente de botão
│   ├── Card.tsx          # Componente de card
│   ├── InputField.tsx    # Componentes de input
│   └── CapyLogo.tsx      # Logo da capivara
├── lib/                  # Utilitários
│   └── utils.ts          # Função cn() para classes
├── public/               # Arquivos estáticos
├── tailwind.config.js    # Configuração do Tailwind
├── tsconfig.json         # Configuração do TypeScript
└── package.json          # Dependências e scripts
```

## 🎯 Componentes Principais

### Button
Botão reutilizável com variantes:
- `primary`: Marrom/dourado (ações principais)
- `secondary`: Verde claro (ações secundárias)  
- `ghost`: Transparente (ações sutis)

```tsx
<Button variant="primary" size="lg" onClick={handleClick}>
  Continue
</Button>
```

### Card
Container com bordas arredondadas e sombra:
- `CardHeader`: Cabeçalho com botão de voltar opcional
- `CardContent`: Conteúdo com espaçamento consistente

```tsx
<Card variant="elevated">
  <CardHeader showBackButton onBackClick={onBack}>
    Title
  </CardHeader>
  <CardContent>
    {children}
  </CardContent>
</Card>
```

### InputField & SelectField
Campos de entrada com estilo consistente:

```tsx
<SelectField
  label="From"
  options={tokenOptions}
  value={selectedToken}
  onChange={setSelectedToken}
/>
```

## 🔄 Fluxo de Navegação

A navegação é gerenciada via estado local (`currentScreen`):

```tsx
const [currentScreen, setCurrentScreen] = useState<Screen>('home');

// Navegação programática
const handleSwapClick = () => setCurrentScreen('swap');
const handleBackToHome = () => setCurrentScreen('home');
```

### Estados de Tela
- `home`: Tela inicial com saldo e botões principais
- `swap`: Interface de troca de tokens
- `payBill`: Interface de pagamento de boletos
- `transactions`: Visualização de transações e pontos
- `referral`: Link de referência
- `points`: Detalhes de pontos e moedas

## 🎨 Sistema de Design

### Paleta de Cores
```css
/* Backgrounds */
bg-teal-300     /* Fundo principal */
bg-green-50     /* Cards e elementos secundários */

/* Botões */
bg-amber-700    /* Botão primário */
bg-green-50     /* Botão secundário */

/* Texto */
text-slate-800  /* Texto principal */
text-slate-600  /* Texto secundário */
text-slate-400  /* Placeholders */
```

### Espaçamento e Bordas
- `rounded-3xl`: Bordas muito arredondadas para cards
- `rounded-2xl`: Bordas arredondadas para inputs
- `rounded-full`: Bordas circulares para botões
- `p-4`, `p-6`: Padding interno consistente
- `gap-3`, `gap-4`: Espaçamento entre elementos

## 📱 Responsividade

O app é **mobile-first** com:
- Largura máxima de `max-w-sm` (384px) para telas
- Touch targets mínimos de 44px
- Espaçamento otimizado para polegares
- Safe area support para dispositivos com notch

## 🔧 Scripts Disponíveis

```bash
npm run dev          # Desenvolvimento com hot reload
npm run build        # Build de produção
npm run start        # Servidor de produção
npm run lint         # Linting com ESLint
npm run type-check   # Verificação de tipos TypeScript
```

## 🧪 Integração com Backend

O frontend está preparado para integração com as APIs do backend:

```tsx
// Exemplo de integração futura
const handleSwapContinue = async (fromToken: string, toToken: string) => {
  try {
    const response = await fetch('/api/core/exchange/quote', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      params: { fromToken, toToken, amount }
    });
    
    const quote = await response.json();
    // Processar cotação...
  } catch (error) {
    console.error('Swap failed:', error);
  }
};
```

## 🚀 Deploy

### Vercel (Recomendado)
```bash
# Deploy automático via Git
git push origin main

# Ou deploy manual
npx vercel --prod
```

### Configuração de Produção
- Configure as variáveis de ambiente no painel da Vercel
- Defina o `NEXT_PUBLIC_API_BASE_URL` para o backend em produção
- Configure domínios personalizados se necessário

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/amazing-feature`)
3. Commit suas mudanças (`git commit -m 'Add amazing feature'`)
4. Push para a branch (`git push origin feature/amazing-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---

**🐹 Construído com ❤️ pela equipe Capy Pay** 