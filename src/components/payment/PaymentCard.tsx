'use client';

import { useState } from 'react';
import { STABLECOINS, FIAT_CURRENCIES } from '@/constants';
import { StableCoin, FiatCurrency } from '@/types';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function PaymentCard() {
  const [paymentType, setPaymentType] = useState<'boleto' | 'pix'>('pix');
  const [coin, setCoin] = useState<StableCoin>(STABLECOINS.BRZ);
  const [currency] = useState<FiatCurrency>(FIAT_CURRENCIES.BRL);
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    setIsLoading(true);
    // Simular processamento
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsLoading(false);
    alert(`Pagamento ${paymentType.toUpperCase()} processado: ${currency.symbol}${amount}`);
  };

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <span className="mr-2">💳</span>
        Pagamentos no Brasil
      </h3>

      {/* Tipo de pagamento */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de pagamento
        </label>
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setPaymentType('pix')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
              paymentType === 'pix'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600'
            }`}
          >
            📱 PIX
          </button>
          <button
            onClick={() => setPaymentType('boleto')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
              paymentType === 'boleto'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600'
            }`}
          >
            🧾 Boleto
          </button>
        </div>
      </div>

      {/* Stablecoin */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pagar com
        </label>
        <select
          value={coin.symbol}
          onChange={(e) => setCoin(STABLECOINS[e.target.value])}
          className="input-field"
        >
          {Object.values(STABLECOINS).map((stablecoin) => (
            <option key={stablecoin.symbol} value={stablecoin.symbol}>
              {stablecoin.icon} {stablecoin.name} ({stablecoin.symbol})
            </option>
          ))}
        </select>
      </div>

      {/* Valor */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Valor em {currency.code}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-3 text-gray-500">
            {currency.symbol}
          </span>
          <input
            type="number"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-field pl-8"
          />
        </div>
      </div>

      {/* Destinatário */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {paymentType === 'pix' ? 'Chave PIX' : 'Código do boleto'}
        </label>
        <input
          type="text"
          placeholder={
            paymentType === 'pix' 
              ? 'CPF, e-mail, telefone ou chave aleatória'
              : 'Cole o código de barras do boleto'
          }
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="input-field"
        />
      </div>

      {/* Resumo */}
      {amount && (
        <div className="bg-gray-50 rounded-xl p-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Valor:</span>
            <span className="font-medium">{currency.symbol} {amount}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">Taxa de serviço:</span>
            <span className="font-medium">{currency.symbol} {(parseFloat(amount || '0') * 0.01).toFixed(2)}</span>
          </div>
          <hr className="my-2 border-gray-200" />
          <div className="flex justify-between text-sm font-semibold">
            <span>Total em {coin.symbol}:</span>
            <span>{(parseFloat(amount || '0') * 1.01 / 5.5).toFixed(4)} {coin.symbol}</span>
          </div>
        </div>
      )}

      {/* Botão de pagamento */}
      <button
        onClick={handlePayment}
        disabled={!amount || !recipient || isLoading}
        className="btn-primary w-full flex items-center justify-center space-x-2"
      >
        {isLoading ? (
          <LoadingSpinner size="sm" />
        ) : (
          <>
            <span>{paymentType === 'pix' ? '📱' : '🧾'}</span>
            <span>Pagar {paymentType.toUpperCase()}</span>
          </>
        )}
      </button>
    </div>
  );
} 