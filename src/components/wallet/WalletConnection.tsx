'use client';

import { useMiniKit } from '@/hooks/useMiniKit';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function WalletConnection() {
  const { isConnected, connect, user } = useMiniKit();

  if (isConnected && user) {
    return null; // Não mostra nada quando já conectado
  }

  return (
    <div className="card p-6 mb-6 text-center">
      <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">🔗</span>
      </div>
      
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Conecte sua Wallet
      </h2>
      
      <p className="text-gray-600 mb-6">
        Para usar o Capy Pay, você precisa conectar sua wallet através do World ID
      </p>

      <button
        onClick={connect}
        className="btn-primary w-full flex items-center justify-center space-x-2"
      >
        <span>🌍</span>
        <span>Conectar com World ID</span>
      </button>

      <div className="mt-4 text-xs text-gray-500">
        <p>Seguro • Privado • Descentralizado</p>
      </div>
    </div>
  );
} 