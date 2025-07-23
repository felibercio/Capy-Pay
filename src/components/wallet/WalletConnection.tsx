'use client';

import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CapyLogo } from '@/components/CapyLogo';

export function WalletConnection() {
  const handleConnect = () => {
    console.log('Simulação: Conexão de carteira');
    // Simulação - funcionalidade completa será implementada posteriormente
  };

  return (
    <div className="card p-6 mb-6 text-center">
      <div className="flex justify-center mb-4">
        <CapyLogo size="md" />
      </div>
      
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Conecte sua Wallet
      </h2>
      
      <p className="text-gray-600 mb-6">
        Para usar o Capy Pay, você precisa conectar sua wallet (Simulação)
      </p>

      <button
        onClick={handleConnect}
        className="btn-primary w-full flex items-center justify-center space-x-2"
      >
        <span>🌍</span>
        <span>Conectar Wallet (Simulado)</span>
      </button>

      <div className="mt-4 text-xs text-gray-500">
        <p>Esta é uma simulação - funcionalidade em desenvolvimento</p>
      </div>
    </div>
  );
} 