'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiRepeat,
  FiCheck
} from 'react-icons/fi';

export default function ExchangePage() {
  const [fromCurrency, setFromCurrency] = useState('BRL');
  const [toCurrency, setToCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [convertedAmount, setConvertedAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState(5.15); // Simulação

  // Atualiza a taxa de câmbio conforme as moedas (simulado)
  useEffect(() => {
    if (fromCurrency === 'BRL' && toCurrency === 'USD') {
      setExchangeRate(5.15);
    } else if (fromCurrency === 'USD' && toCurrency === 'BRL') {
      setExchangeRate(0.194); // Aproximadamente 1 / 5.15
    } else {
      setExchangeRate(1); // mesma moeda
    }
  }, [fromCurrency, toCurrency]);

  // Converte automaticamente ao digitar ou mudar moedas
  useEffect(() => {
    const value = parseFloat(amount.replace(',', '.'));
    if (!isNaN(value) && value > 0) {
      const result =
        fromCurrency === toCurrency
          ? value
          : toCurrency === 'BRL'
          ? value * (1 / exchangeRate)
          : value / exchangeRate;

      setConvertedAmount(result.toFixed(2));
    } else {
      setConvertedAmount('');
    }
  }, [amount, exchangeRate, fromCurrency, toCurrency]);

  return (
    <main className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/dashboard"
          className="flex items-center text-capy-dark hover:text-capy-teal transition-colors"
        >
          <FiArrowLeft className="w-5 h-5 mr-2" />
          Voltar
        </Link>
        <h1 className="text-2xl font-bold text-capy-dark">Câmbio</h1>
        <div className="w-16"></div>
      </div>

      {/* Conteúdo principal */}
      <div className="space-y-6">
        {/* Formulário de câmbio */}
        <div className="capy-card">
          <h3 className="text-lg font-semibold text-capy-dark mb-4">Conversão de Moeda</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-capy-dark mb-1">De</label>
              <select
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
              >
                <option value="BRL">Real (BRL)</option>
                <option value="USD">Dólar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-capy-dark mb-1">Para</label>
              <select
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
              >
                <option value="USD">Dólar (USD)</option>
                <option value="BRL">Real (BRL)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-capy-dark mb-1">Valor</label>
            <input
              type="text"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-capy-teal focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Prévia em tempo real */}
        {convertedAmount && (
          <div className="capy-card bg-green-50 border-green-200 text-green-800">
            <p className="text-lg font-semibold flex items-center">
              <FiCheck className="mr-2" />
              Prévia: {convertedAmount} {toCurrency}
            </p>
            <p className="text-sm mt-2 text-green-700">
              Taxa simulada: 1 {toCurrency} = {exchangeRate} {fromCurrency}
            </p>
          </div>
        )}

        {/* Botão de conversão */}
        {amount && (
          <div className="capy-card">
            <button
              onClick={() =>
                console.log(`Conversão confirmada: ${convertedAmount} ${toCurrency}`)
              }
              className="w-full py-4 rounded-lg text-lg font-semibold bg-capy-teal text-white hover:bg-capy-dark-teal transition-all duration-300"
            >
              <span className="flex items-center justify-center">
                <FiRepeat className="w-5 h-5 mr-2" />
                Confirmar Conversão
              </span>
            </button>
          </div>
        )}

        {/* Instruções */}
        <div className="capy-card bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">Como Funciona</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• Escolha as moedas de origem e destino</li>
            <li>• Digite o valor desejado</li>
            <li>• Veja a prévia da conversão em tempo real</li>
            <li>• Clique em "Confirmar Conversão" para registrar a operação (simulação)</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
