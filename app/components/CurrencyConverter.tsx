'use client';

import React from 'react';
import { ArrowLeftRight, DollarSign } from 'lucide-react';

interface CurrencyConverterProps {
  onClose?: () => void;
}

export default function CurrencyConverter({ onClose }: CurrencyConverterProps) {
  const [amount, setAmount] = React.useState('');
  const [fromCurrency, setFromCurrency] = React.useState('USD');
  const [toCurrency, setToCurrency] = React.useState('USDC');
  
  const exchangeRate = 0.99;
  const convertedAmount = amount ? (parseFloat(amount) * exchangeRate).toFixed(2) : '';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-capy-dark mb-2">
          From
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="capy-input pr-20"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-capy-dark" />
            <select 
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
              className="bg-transparent text-capy-dark font-medium focus:outline-none"
            >
              <option>USD</option>
              <option>BRL</option>
              <option>EUR</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="flex justify-center">
        <div className="bg-capy-brown rounded-full p-2">
          <ArrowLeftRight className="w-6 h-6 text-white rotate-90" />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-capy-dark mb-2">
          To
        </label>
        <div className="relative">
          <input
            type="text"
            value={convertedAmount}
            readOnly
            placeholder="0.00"
            className="capy-input pr-20 bg-capy-light"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <div className="w-6 h-6 bg-capy-teal rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">T</span>
            </div>
            <select 
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
              className="bg-transparent text-capy-dark font-medium focus:outline-none"
            >
              <option>USDC</option>
              <option>USDT</option>
              <option>DAI</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="text-center text-sm text-gray-600 py-2">
        1 {fromCurrency} = {exchangeRate} {toCurrency}
      </div>
      
      <button className="capy-button w-full">
        Continue
      </button>
    </div>
  );
} 