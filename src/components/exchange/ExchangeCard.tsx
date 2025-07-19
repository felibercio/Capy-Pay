'use client';

import { useState } from 'react';
import { STABLECOINS, FIAT_CURRENCIES } from '@/constants';
import { StableCoin, FiatCurrency } from '@/types';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function ExchangeCard() {
  const [fromCoin, setFromCoin] = useState<StableCoin>(STABLECOINS.USDC);
  const [toCurrency, setToCurrency] = useState<FiatCurrency>(FIAT_CURRENCIES.BRL);
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleExchange = async () => {
    setIsLoading(true);
    // Simular processamento
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsLoading(false);
    alert(`Câmbio realizado: ${amount} ${fromCoin.symbol} → ${toCurrency.code}`);
  };

  const estimatedAmount = amount ? (parseFloat(amount) * 5.5).toFixed(2) : '0.00';

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <span className="mr-2">💱</span>
        Câmbio de Stablecoins
      </h3>

      {/* De (Stablecoin) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          De
        </label>
        <div className="grid grid-cols-2 gap-3">
          <select
            value={fromCoin.symbol}
            onChange={(e) => setFromCoin(STABLECOINS[e.target.value])}
            className="input-field"
          >
            {Object.values(STABLECOINS).map((coin) => (
              <option key={coin.symbol} value={coin.symbol}>
                {coin.icon} {coin.symbol}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      {/* Para (Fiat) */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Para
        </label>
        <div className="grid grid-cols-2 gap-3">
          <select
            value={toCurrency.code}
            onChange={(e) => setToCurrency(FIAT_CURRENCIES[e.target.value])}
            className="input-field"
          >
            {Object.values(FIAT_CURRENCIES).map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.flag} {currency.code}
              </option>
            ))}
          </select>
          <div className="input-field bg-gray-50 flex items-center">
            <span className="text-gray-900 font-medium">
              {toCurrency.symbol} {estimatedAmount}
            </span>
          </div>
        </div>
      </div>

      {/* Taxa de câmbio */}
      <div className="bg-gray-50 rounded-xl p-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Taxa de câmbio:</span>
          <span className="font-medium">1 {fromCoin.symbol} = 5.50 {toCurrency.code}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-600">Taxa de serviço:</span>
          <span className="font-medium">0.5%</span>
        </div>
      </div>

      {/* Botão de câmbio */}
      <button
        onClick={handleExchange}
        disabled={!amount || isLoading}
        className="btn-primary w-full flex items-center justify-center space-x-2"
      >
        {isLoading ? (
          <LoadingSpinner size="sm" />
        ) : (
          <>
            <span>💸</span>
            <span>Realizar Câmbio</span>
          </>
        )}
      </button>
    </div>
  );
} 