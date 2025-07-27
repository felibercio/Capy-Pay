// Serviço para interação com o Smart Contract CapyCoin
import { CONTRACT_CONFIG, isSimulationMode, formatTokenAmount, parseTokenAmount } from './config';

// Interface para dados do usuário
interface UserInfo {
  active: boolean;
  balance: string;
  totalRewards: string;
  canClaim: boolean;
  nextRewardIn: number;
}

// Dados simulados (para modo simulação)
const simulatedData = {
  users: new Map<string, {
    active: boolean;
    balance: bigint;
    totalRewards: bigint;
    lastRewardTime: number;
  }>(),
  totalSupply: BigInt('1000000000000000000000000'), // 1M CAPY inicial
  totalActiveUsers: 1,
  totalRewardsPaid: BigInt(0)
};

// Classe principal do serviço
export class CapyCoinService {
  private static instance: CapyCoinService;
  
  private constructor() {
    // Inicializar usuário padrão em modo simulação
    if (isSimulationMode()) {
      simulatedData.users.set('0x1234567890abcdef1234567890abcdef12345678', {
        active: true,
        balance: BigInt('1000000000000000000000'), // 1000 CAPY
        totalRewards: BigInt(0),
        lastRewardTime: 0
      });
    }
  }
  
  static getInstance(): CapyCoinService {
    if (!CapyCoinService.instance) {
      CapyCoinService.instance = new CapyCoinService();
    }
    return CapyCoinService.instance;
  }
  
  // ==========================================
  // MÉTODOS PÚBLICOS
  // ==========================================
  
  async getTokenInfo() {
    if (isSimulationMode()) {
      return {
        name: CONTRACT_CONFIG.token.name,
        symbol: CONTRACT_CONFIG.token.symbol,
        decimals: CONTRACT_CONFIG.token.decimals,
        totalSupply: formatTokenAmount(simulatedData.totalSupply),
        maxSupply: CONTRACT_CONFIG.token.maxSupply,
        remainingSupply: formatTokenAmount(
          BigInt(CONTRACT_CONFIG.token.maxSupply) * BigInt(10 ** CONTRACT_CONFIG.token.decimals) - simulatedData.totalSupply
        )
      };
    }
    
    // TODO: Implementar chamada real ao contrato
    throw new Error('Blockchain integration not implemented');
  }
  
  async getUserInfo(address: string): Promise<UserInfo> {
    if (isSimulationMode()) {
      const user = simulatedData.users.get(address) || {
        active: false,
        balance: BigInt(0),
        totalRewards: BigInt(0),
        lastRewardTime: 0
      };
      
      const now = Date.now() / 1000;
      const dayInSeconds = 24 * 60 * 60;
      const canClaim = user.active && (now >= user.lastRewardTime + dayInSeconds);
      const nextRewardIn = user.active && !canClaim 
        ? Math.max(0, (user.lastRewardTime + dayInSeconds) - now)
        : 0;
      
      return {
        active: user.active,
        balance: formatTokenAmount(user.balance),
        totalRewards: formatTokenAmount(user.totalRewards),
        canClaim,
        nextRewardIn: Math.floor(nextRewardIn)
      };
    }
    
    // TODO: Implementar chamada real ao contrato
    throw new Error('Blockchain integration not implemented');
  }
  
  async getBalance(address: string): Promise<string> {
    if (isSimulationMode()) {
      const user = simulatedData.users.get(address);
      return formatTokenAmount(user?.balance || BigInt(0));
    }
    
    // TODO: Implementar chamada real ao contrato
    throw new Error('Blockchain integration not implemented');
  }
  
  async claimDailyReward(address: string): Promise<boolean> {
    if (isSimulationMode()) {
      const user = simulatedData.users.get(address);
      if (!user || !user.active) {
        throw new Error('User not active');
      }
      
      const now = Date.now() / 1000;
      const dayInSeconds = 24 * 60 * 60;
      
      if (now < user.lastRewardTime + dayInSeconds) {
        throw new Error('Reward already claimed today');
      }
      
      const rewardAmount = parseTokenAmount(CONTRACT_CONFIG.token.rewardAmount);
      user.balance += rewardAmount;
      user.totalRewards += rewardAmount;
      user.lastRewardTime = now;
      simulatedData.totalRewardsPaid += rewardAmount;
      simulatedData.totalSupply += rewardAmount;
      
      console.log(`✅ Recompensa diária reivindicada: ${CONTRACT_CONFIG.token.rewardAmount} CAPY`);
      return true;
    }
    
    // TODO: Implementar chamada real ao contrato
    throw new Error('Blockchain integration not implemented');
  }
  
  async transfer(from: string, to: string, amount: string): Promise<boolean> {
    if (isSimulationMode()) {
      const sender = simulatedData.users.get(from);
      if (!sender) {
        throw new Error('Sender not found');
      }
      
      const amountBigInt = parseTokenAmount(amount);
      if (sender.balance < amountBigInt) {
        throw new Error('Insufficient balance');
      }
      
      // Criar destinatário se não existir
      if (!simulatedData.users.has(to)) {
        simulatedData.users.set(to, {
          active: true,
          balance: BigInt(0),
          totalRewards: BigInt(0),
          lastRewardTime: 0
        });
        simulatedData.totalActiveUsers++;
      }
      
      const recipient = simulatedData.users.get(to)!;
      sender.balance -= amountBigInt;
      recipient.balance += amountBigInt;
      
      console.log(`✅ Transferência simulada: ${amount} CAPY de ${from} para ${to}`);
      return true;
    }
    
    // TODO: Implementar chamada real ao contrato
    throw new Error('Blockchain integration not implemented');
  }
  
  async mint(to: string, amount: string): Promise<boolean> {
    if (isSimulationMode()) {
      // Simular mint (apenas owner poderia fazer isso)
      if (!simulatedData.users.has(to)) {
        simulatedData.users.set(to, {
          active: true,
          balance: BigInt(0),
          totalRewards: BigInt(0),
          lastRewardTime: 0
        });
        simulatedData.totalActiveUsers++;
      }
      
      const user = simulatedData.users.get(to)!;
      const amountBigInt = parseTokenAmount(amount);
      user.balance += amountBigInt;
      simulatedData.totalSupply += amountBigInt;
      
      console.log(`✅ Mint simulado: ${amount} CAPY para ${to}`);
      return true;
    }
    
    // TODO: Implementar chamada real ao contrato
    throw new Error('Blockchain integration not implemented');
  }
  
  async getStats() {
    if (isSimulationMode()) {
      return {
        activeUsers: simulatedData.totalActiveUsers,
        rewardsPaid: formatTokenAmount(simulatedData.totalRewardsPaid),
        avgRewardPerUser: simulatedData.totalActiveUsers > 0 
          ? formatTokenAmount(simulatedData.totalRewardsPaid / BigInt(simulatedData.totalActiveUsers))
          : '0'
      };
    }
    
    // TODO: Implementar chamada real ao contrato
    throw new Error('Blockchain integration not implemented');
  }
  
  // ==========================================
  // HELPERS
  // ==========================================
  
  isConnected(): boolean {
    // Em modo simulação, sempre conectado
    return isSimulationMode() || CONTRACT_CONFIG.address !== null;
  }
  
  getContractAddress(): string | null {
    return CONTRACT_CONFIG.address;
  }
  
  getChainId(): number {
    return CONTRACT_CONFIG.chainId;
  }
  
  formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return 'Disponível agora';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}

// Exportar instância única
export const capyCoinService = CapyCoinService.getInstance(); 