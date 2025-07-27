'use client';

import React from 'react';
import { useCapyCoin } from '@/hooks/useCapyCoin';
import { FiRefreshCw, FiGift } from 'react-icons/fi';

interface CapyCoinBalanceProps {
  userAddress?: string;
  showRewardButton?: boolean;
}

export function CapyCoinBalance({ 
  userAddress = '0x1234567890abcdef1234567890abcdef12345678',
  showRewardButton = true 
}: CapyCoinBalanceProps) {
  const { 
    loading, 
    error, 
    userInfo, 
    claimDailyReward, 
    formatTimeRemaining,
    refresh 
  } = useCapyCoin(userAddress);

  const handleClaimReward = async () => {
    const success = await claimDailyReward();
    if (success) {
      // Pode adicionar notificação de sucesso aqui
      console.log('✅ Recompensa reivindicada com sucesso!');
    }
  };

  if (loading && !userInfo) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-32"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">Saldo CAPY</h3>
        <button
          onClick={refresh}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          title="Atualizar"
        >
          <FiRefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-bold text-gray-900">
          {userInfo?.balance || '0'}
        </span>
        <span className="text-sm text-gray-500">CAPY</span>
      </div>

      {userInfo && (
        <div className="text-xs text-gray-500 mb-3">
          Total ganho: {userInfo.totalRewards} CAPY
        </div>
      )}

      {showRewardButton && userInfo && (
        <div className="border-t pt-3">
          {userInfo.canClaim ? (
            <button
              onClick={handleClaimReward}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-capy-teal hover:bg-capy-dark-teal text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiGift className="w-4 h-4" />
              <span>Resgatar Recompensa Diária</span>
            </button>
          ) : (
            <div className="text-center">
              <p className="text-sm text-gray-500">Próxima recompensa em:</p>
              <p className="text-lg font-semibold text-capy-brown">
                {formatTimeRemaining(userInfo.nextRewardIn)}
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 p-2 bg-red-50 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
} 