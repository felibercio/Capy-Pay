'use client';

import { APP_CONFIG } from '@/constants';
import { CapyLogo } from '@/components/CapyLogo';

export function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-100 safe-area-inset">
      <div className="container mx-auto px-4 py-4 max-w-md">
        <div className="flex items-center justify-between">
          {/* Logo e Nome */}
          <div className="flex items-center space-x-3">
            <CapyLogo size="sm" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{APP_CONFIG.name}</h1>
              <p className="text-xs text-gray-500">{APP_CONFIG.description}</p>
            </div>
          </div>

          {/* Placeholder para informações do usuário */}
          <div className="flex items-center space-x-2">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                0x1234...5678
              </p>
              <p className="text-xs text-gray-500">Simulado</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
} 