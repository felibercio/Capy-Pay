'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiRepeat,
  FiCheck,
  FiLoader
} from 'react-icons/fi';

export default function ExchangePage() {
  // Tokens suportados na Base para câmbio onchain
  const [fromToken, setFromToken] = useState<'USDC' | 'BRZ' | 'EURC'>('USDC');
  const [toToken, setToToken] = useState<'USDC' | 'BRZ' | 'EURC'>('EURC');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<{ toAmount: string; gasEstimate: string } | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [executingSwap, setExecutingSwap] = useState(false);
  const [swapResult, setSwapResult] = useState<{ txHash: string; toAmount: string } | null>(null);

  // Normalização e validação do valor
  const parsedAmount = parseFloat((amount || '').replace(',', '.'));
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;

  // Buscar cotação 1inch via backend
  async function fetchQuote() {
    const value = parseFloat((amount || '').replace(',', '.'));
    if (isNaN(value) || value <= 0 || fromToken === toToken) {
      setQuote(null);
      return;
    }
    try {
      setLoadingQuote(true);
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const res = await fetch(`${API_BASE}/api/blockchain/swap/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromToken, toToken, amount: value }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setQuote({ toAmount: json.data.toAmount, gasEstimate: json.data.gasEstimate });
      } else {
        setQuote(null);
      }
    } catch (err) {
      setQuote(null);
    } finally {
      setLoadingQuote(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => fetchQuote(), 300);
    return () => clearTimeout(timeout);
  }, [amount, fromToken, toToken]);

  async function executeSwapServer() {
    const value = parseFloat((amount || '').replace(',', '.'));
    if (isNaN(value) || value <= 0) return;
    try {
      setExecutingSwap(true);
      setSwapResult(null);
      // Default para 'mock' em desenvolvimento quando variável não está definida
      const mode = (process.env.NEXT_PUBLIC_SWAP_MODE || 'mock').trim().toLowerCase();
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const endpoint = mode === 'mock'
        ? `${API_BASE}/api/blockchain/swap/execute/mock`
        : `${API_BASE}/api/blockchain/swap/execute/server`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromToken, toToken, amount: value }),
      });
      const contentType = res.headers.get('content-type') || '';
      let json: any = null;
      let text = '';
      try {
        if (contentType.includes('application/json')) {
          json = await res.json();
        } else {
          text = await res.text();
        }
      } catch (parseErr) {
        // Fallback: tentar ler como texto se o parse JSON falhar
        try {
          text = await res.text();
        } catch {}
      }

      if (res.ok && json && json.success && json.data) {
        setSwapResult({ txHash: json.data.txHash, toAmount: json.data.toAmount });
      } else {
        const message = (json && (json.error || json.message)) || text || 'Falha ao executar swap';
        alert(`${message} (status ${res.status})`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Erro na execução do swap: ${message}`);
    } finally {
      setExecutingSwap(false);
    }
  }

  return (
    <main className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/dashboard"
          prefetch={false}
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
        {/* Formulário de câmbio onchain (swap) */}
        <div className="capy-card">
          <h3 className="text-lg font-semibold text-capy-dark mb-4">Câmbio Onchain (Swap) - Simulado</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-capy-dark mb-1">De (Token)</label>
              <select
                value={fromToken}
                onChange={(e) => setFromToken(e.target.value as 'USDC' | 'BRZ' | 'EURC')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
              >
                <option value="USDC">USDC</option>
                <option value="BRZ">BRZ</option>
                <option value="EURC">EURC</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-capy-dark mb-1">Para (Token)</label>
              <select
                value={toToken}
                onChange={(e) => setToToken(e.target.value as 'USDC' | 'BRZ' | 'EURC')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
              >
                <option value="USDC">USDC</option>
                <option value="BRZ">BRZ</option>
                <option value="EURC">EURC</option>
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

        {/* Cotação */}
        <div className="capy-card bg-green-50 border-green-200 text-green-800">
          {loadingQuote ? (
            <p className="text-lg font-semibold flex items-center">
              <FiLoader className="mr-2 animate-spin" />
              Buscando cotação...
            </p>
          ) : quote ? (
            <>
              <p className="text-lg font-semibold flex items-center">
                <FiCheck className="mr-2" />
                Prévia: {quote.toAmount} {toToken}
              </p>
              <p className="text-sm mt-2 text-green-700">
                Estimativa de gas: {quote.gasEstimate}
              </p>
            </>
          ) : (
            <p className="text-sm">
              {fromToken === toToken
                ? 'Selecione tokens diferentes para cotar.'
                : 'Informe um valor válido para cotar.'}
            </p>
          )}
        </div>

        {/* Executar swap via servidor */}
        <div className="capy-card">
          <button
            onClick={executeSwapServer}
            disabled={executingSwap || fromToken === toToken || !isValidAmount}
            className={`w-full py-4 rounded-lg text-lg font-semibold transition-all duration-300 ${
              executingSwap || !isValidAmount || fromToken === toToken
                ? 'bg-gray-300 text-gray-600'
                : 'bg-capy-teal text-white hover:bg-capy-dark-teal'
            }`}
          >
            <span className="flex items-center justify-center">
              {executingSwap ? (
                <>
                  <FiLoader className="w-5 h-5 mr-2 animate-spin" />
                  Executando swap...
                </>
              ) : (
                <>
                  <FiRepeat className="w-5 h-5 mr-2" />
                  {((process.env.NEXT_PUBLIC_SWAP_MODE || '').trim().toLowerCase() === 'mock') ? 'Executar Swap (mock)' : 'Executar Swap (servidor)'}
                </>
              )}
            </span>
          </button>
          {swapResult && (
            <p className="mt-3 text-sm text-capy-dark">
              Swap concluído: {swapResult.toAmount} {toToken} — TX: {' '}
              <a
                className="text-capy-teal underline"
                href={`https://basescan.org/tx/${swapResult.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {swapResult.txHash.substring(0, 10)}...
              </a>
            </p>
          )}
        </div>

        {/* Instruções */}
        <div className="capy-card bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">Como Funciona</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• Escolha os tokens de origem e destino (USDC, BRZ, EURC)</li>
            <li>• Digite o valor desejado</li>
            <li>• Veja a cotação onchain via 1inch</li>
            <li>• Execute o swap usando a wallet do servidor (dev)</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
