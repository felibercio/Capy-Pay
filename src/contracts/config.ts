// Configuração do Smart Contract CapyCoin
export const CONTRACT_CONFIG = {
  // Endereço do contrato (null = modo simulação)
  address: null as string | null,
  
  // Chain ID (84532 = Base Sepolia, 8453 = Base Mainnet)
  chainId: 84532,
  
  // RPC URLs
  rpcUrls: {
    testnet: 'https://sepolia.base.org',
    mainnet: 'https://mainnet.base.org'
  },
  
  // Block Explorer URLs
  blockExplorers: {
    testnet: 'https://sepolia.basescan.org',
    mainnet: 'https://basescan.org'
  },
  
  // Modo simulação (true = sem blockchain real)
  simulationMode: true,
  
  // Configurações do token
  token: {
    name: 'Capy Coin',
    symbol: 'CAPY',
    decimals: 18,
    maxSupply: '100000000', // 100M CAPY
    rewardAmount: '10' // 10 CAPY por recompensa
  }
};

// Helper para verificar se está em modo simulação
export const isSimulationMode = () => CONTRACT_CONFIG.simulationMode || !CONTRACT_CONFIG.address;

// Helper para obter RPC URL
export const getRpcUrl = (network: 'testnet' | 'mainnet' = 'testnet') => {
  return CONTRACT_CONFIG.rpcUrls[network];
};

// Helper para obter Block Explorer URL
export const getBlockExplorerUrl = (network: 'testnet' | 'mainnet' = 'testnet') => {
  return CONTRACT_CONFIG.blockExplorers[network];
};

// Helper para formatar endereço
export const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Helper para converter valores
export const parseTokenAmount = (amount: string, decimals: number = 18): bigint => {
  const [whole, decimal = ''] = amount.split('.');
  const paddedDecimal = decimal.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedDecimal);
};

export const formatTokenAmount = (amount: bigint, decimals: number = 18): string => {
  const str = amount.toString().padStart(decimals + 1, '0');
  const whole = str.slice(0, -decimals) || '0';
  const decimal = str.slice(-decimals).replace(/0+$/, '');
  return decimal ? `${whole}.${decimal}` : whole;
}; 