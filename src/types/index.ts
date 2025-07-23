// Tipos para stablecoins
export interface StableCoin {
  symbol: 'USDC' | 'EURC' | 'BRZ';
  name: string;
  address: string;
  decimals: number;
  icon: string;
  color: string;
}

// Tipos para moedas fiat
export interface FiatCurrency {
  code: 'USD' | 'EUR' | 'BRL';
  name: string;
  symbol: string;
  flag: string;
}

// Tipos para transações de câmbio
export interface ExchangeTransaction {
  id: string;
  fromCoin: StableCoin;
  toCurrency: FiatCurrency;
  fromAmount: string;
  toAmount: string;
  rate: number;
  fee: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: number;
  txHash?: string;
}

// Tipos para pagamentos
export interface PaymentTransaction {
  id: string;
  type: 'boleto' | 'pix';
  amount: string;
  currency: FiatCurrency;
  coin: StableCoin;
  recipient: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: number;
  txHash?: string;
}

// Tipos para wallet
export interface WalletState {
  address: string | null;
  isConnected: boolean;
  balances: Record<string, string>;
  isLoading: boolean;
}

// Tipos para MiniKit
export interface MiniKitState {
  isInitialized: boolean;
  isConnected: boolean;
  user: {
    worldId?: string;
    walletAddress?: string;
  } | null;
}

// Tipos para cotações
export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
}

// Tipos para componentes UI
export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  variant?: 'spinner' | 'logo';
}

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

// Tipos para formulários
export interface ExchangeFormData {
  fromCoin: StableCoin;
  toCurrency: FiatCurrency;
  amount: string;
}

export interface PaymentFormData {
  paymentType: 'boleto' | 'pix';
  amount: string;
  currency: FiatCurrency;
  coin: StableCoin;
  recipient: string;
} 