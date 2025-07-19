import { StableCoin, FiatCurrency } from '@/types';

// Configurações da rede Base
export const BASE_NETWORK = {
  chainId: 8453,
  name: 'Base',
  rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
  blockExplorer: 'https://basescan.org',
};

export const BASE_TESTNET = {
  chainId: 84532,
  name: 'Base Sepolia',
  rpcUrl: process.env.NEXT_PUBLIC_BASE_TESTNET_RPC_URL || 'https://sepolia.base.org',
  blockExplorer: 'https://sepolia.basescan.org',
};

// Stablecoins disponíveis na Base
export const STABLECOINS: Record<string, StableCoin> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    address: process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    icon: '💵',
    color: '#2775ca',
  },
  EURC: {
    symbol: 'EURC',
    name: 'Euro Coin',
    address: process.env.NEXT_PUBLIC_EURC_CONTRACT || '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
    decimals: 6,
    icon: '💶',
    color: '#1e40af',
  },
  BRZ: {
    symbol: 'BRZ',
    name: 'Brazilian Digital Token',
    address: process.env.NEXT_PUBLIC_BRZ_CONTRACT || '0x420000000000000000000000000000000000000A',
    decimals: 4,
    icon: '💚',
    color: '#16a34a',
  },
};

// Moedas fiat suportadas
export const FIAT_CURRENCIES: Record<string, FiatCurrency> = {
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    flag: '🇺🇸',
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    flag: '🇪🇺',
  },
  BRL: {
    code: 'BRL',
    name: 'Brazilian Real',
    symbol: 'R$',
    flag: '🇧🇷',
  },
};

// Configurações da aplicação
export const APP_CONFIG = {
  name: 'Capy Pay',
  description: 'Câmbio e pagamentos internacionais',
  version: '1.0.0',
  supportedLanguages: ['pt-BR', 'en-US'],
  defaultLanguage: 'pt-BR',
};

// Limites de transação
export const TRANSACTION_LIMITS = {
  min: {
    USDC: 1,
    EURC: 1,
    BRZ: 5,
  },
  max: {
    USDC: 10000,
    EURC: 10000,
    BRZ: 50000,
  },
};

// Taxas de transação (em porcentagem)
export const TRANSACTION_FEES = {
  exchange: 0.5, // 0.5%
  payment: 1.0, // 1.0%
};

// URLs de API
export const API_ENDPOINTS = {
  exchangeRates: 'https://api.coingecko.com/api/v3/simple/price',
  paymentProcessor: '/api/payments',
  transactionHistory: '/api/transactions',
};

// Configurações do MiniKit
export const MINIKIT_CONFIG = {
  appId: process.env.NEXT_PUBLIC_APP_ID || '',
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
}; 