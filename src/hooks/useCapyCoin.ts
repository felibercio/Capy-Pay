// Hook customizado para interação com o CapyCoin
import { useState, useEffect, useCallback } from 'react';
import { capyCoinService } from '@/contracts/capyCoinService';

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  maxSupply: string;
  remainingSupply: string;
}

interface UserInfo {
  active: boolean;
  balance: string;
  totalRewards: string;
  canClaim: boolean;
  nextRewardIn: number;
}

export function useCapyCoin(userAddress?: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // Carregar informações do token
  const loadTokenInfo = useCallback(async () => {
    try {
      setLoading(true);
      const info = await capyCoinService.getTokenInfo();
      setTokenInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar token');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar informações do usuário
  const loadUserInfo = useCallback(async () => {
    if (!userAddress) return;
    
    try {
      setLoading(true);
      const info = await capyCoinService.getUserInfo(userAddress);
      setUserInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuário');
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  // Reivindicar recompensa diária
  const claimDailyReward = useCallback(async () => {
    if (!userAddress) {
      setError('Endereço não fornecido');
      return false;
    }

    try {
      setLoading(true);
      setError(null);
      await capyCoinService.claimDailyReward(userAddress);
      await loadUserInfo(); // Recarregar informações
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reivindicar recompensa');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userAddress, loadUserInfo]);

  // Transferir tokens
  const transfer = useCallback(async (to: string, amount: string) => {
    if (!userAddress) {
      setError('Endereço não fornecido');
      return false;
    }

    try {
      setLoading(true);
      setError(null);
      await capyCoinService.transfer(userAddress, to, amount);
      await loadUserInfo(); // Recarregar informações
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na transferência');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userAddress, loadUserInfo]);

  // Formatar tempo restante
  const formatTimeRemaining = useCallback((seconds: number) => {
    return capyCoinService.formatTimeRemaining(seconds);
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    loadTokenInfo();
  }, [loadTokenInfo]);

  useEffect(() => {
    if (userAddress) {
      loadUserInfo();
    }
  }, [userAddress, loadUserInfo]);

  // Atualizar tempo restante a cada segundo
  useEffect(() => {
    if (!userInfo || userInfo.canClaim || userInfo.nextRewardIn === 0) return;

    const interval = setInterval(() => {
      setUserInfo(prev => {
        if (!prev || prev.nextRewardIn <= 0) return prev;
        return {
          ...prev,
          nextRewardIn: Math.max(0, prev.nextRewardIn - 1),
          canClaim: prev.nextRewardIn - 1 <= 0
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [userInfo]);

  return {
    // Estados
    loading,
    error,
    tokenInfo,
    userInfo,
    
    // Ações
    claimDailyReward,
    transfer,
    refresh: () => {
      loadTokenInfo();
      loadUserInfo();
    },
    
    // Helpers
    formatTimeRemaining,
    isConnected: capyCoinService.isConnected(),
    contractAddress: capyCoinService.getContractAddress()
  };
} 