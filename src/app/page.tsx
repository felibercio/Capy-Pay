'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { WalletConnection } from '@/components/wallet/WalletConnection';
import { ExchangeCard } from '@/components/exchange/ExchangeCard';
import { PaymentCard } from '@/components/payment/PaymentCard';
import { useMiniKit } from '@/hooks/useMiniKit';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'exchange' | 'payment'>('exchange');
  const { isInitialized, isConnected } = useMiniKit();

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-50">
      <Header />
      
      <div className="container mx-auto px-4 py-6 max-w-md">
        {/* Conexão da Wallet */}
        <WalletConnection />

        {/* Tabs de Navegação */}
        {isConnected && (
          <>
            <div className="flex bg-white rounded-2xl p-1 mb-6 shadow-sm">
              <button
                onClick={() => setActiveTab('exchange')}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
                  activeTab === 'exchange'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Câmbio
              </button>
              <button
                onClick={() => setActiveTab('payment')}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
                  activeTab === 'payment'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Pagamentos
              </button>
            </div>

            {/* Conteúdo Principal */}
            <div className="space-y-6">
              {activeTab === 'exchange' && <ExchangeCard />}
              {activeTab === 'payment' && <PaymentCard />}
            </div>
          </>
        )}
      </div>
    </div>
  );
} 