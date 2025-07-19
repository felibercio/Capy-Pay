'use client';

import { APP_CONFIG } from '@/constants';
import { useMiniKit } from '@/hooks/useMiniKit';

export function Header() {
  const { user, disconnect } = useMiniKit();

  return (
    <header className="bg-white shadow-sm border-b border-gray-100 safe-area-inset">
      <div className="container mx-auto px-4 py-4 max-w-md">
        <div className="flex items-center justify-between">
          {/* Logo e Nome */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">🦫</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{APP_CONFIG.name}</h1>
              <p className="text-xs text-gray-500">{APP_CONFIG.description}</p>
            </div>
          </div>

          {/* Informações do usuário */}
          {user && (
            <div className="flex items-center space-x-2">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user.walletAddress?.slice(0, 6)}...{user.walletAddress?.slice(-4)}
                </p>
                <p className="text-xs text-gray-500">Conectado</p>
              </div>
              <button
                onClick={disconnect}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                title="Desconectar"
              >
                <span className="text-gray-600">⚡</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
} 