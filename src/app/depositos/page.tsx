'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  FiArrowLeft, 
  FiDownload, 
  FiCopy, 
  FiCheckCircle,
  FiSearch,
  FiAlertTriangle,
  FiLoader
} from 'react-icons/fi';
import { CONTRACT_CONFIG, getBlockExplorerUrl } from '@/contracts/config';

// Rede fixa: Base
type Network = 'Base';

const networkAddresses: Record<Network, string> = {
  Base: '0x7Fb3E9812a1c3a0Bd724e70C59798EfF682C25f9'
};

export default function CryptoDepositPage() {
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('Base'); // dropdown com única opção
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<Array<any>>([]);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [simulateAmountUSDC, setSimulateAmountUSDC] = useState<string>('1');
  const [simulateDesc, setSimulateDesc] = useState<string>('Simulação de depósito USDC');
  const [simulateResult, setSimulateResult] = useState<any>(null);
  const [simulateLoading, setSimulateLoading] = useState(false);

  const handleCopy = () => {
    const address = networkAddresses[selectedNetwork]; // agora está tipado corretamente
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchDeposits = async () => {
    setLoading(true);
    setError(null);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const res = await fetch(`${API_BASE}/api/deposits?userId=${encodeURIComponent(userId)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Falha ao buscar depósitos');
      }
      setDeposits(json.data?.deposits || []);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao carregar depósitos');
      setDeposits([]);
    } finally {
      setLoading(false);
    }
  };

  const getAccessToken = (): string | null => {
    try {
      return (
        localStorage.getItem('accessToken') ||
        localStorage.getItem('token') ||
        localStorage.getItem('jwt') ||
        null
      );
    } catch {
      return null;
    }
  };

  // Decodifica payload JWT (sem verificação) para obter userId com UX automática
  const decodeJwtPayload = (token: string): any | null => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  const fetchMyDeposits = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      if (!token) {
        throw new Error('Você precisa estar autenticado para buscar seus depósitos.');
      }
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const res = await fetch(`${API_BASE}/api/deposits/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Falha ao buscar depósitos');
      }
      setDeposits(json.data?.deposits || []);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao carregar depósitos');
      setDeposits([]);
    } finally {
      setLoading(false);
    }
  };

  // Carregar endereço de carteira (custodial ou conectada) automaticamente
  useEffect(() => {
    const loadAddress = async () => {
      try {
        // 1) Tentar localStorage primeiro
        const localAddr = localStorage.getItem('walletAddress');
        if (localAddr && /^0x[a-fA-F0-9]{40}$/.test(localAddr)) {
          setWalletAddress(localAddr);
          return;
        }

        // 2) Se autenticado, solicitar ao backend
        const token = getAccessToken();
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        if (token) {
          const res = await fetch(`${API_BASE}/api/auth/wallet/address`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          const addr = json?.data || json?.walletAddress || json?.address;
          if (res.ok && addr && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
            setWalletAddress(addr);
            localStorage.setItem('walletAddress', addr);
            // não retorna: permite continuar para carregar userId abaixo
          }
        }
      } catch (e) {
        // Silencioso: manter UI funcional mesmo sem endereço
      }
    };

    loadAddress();
  }, []);

  // Carregar automaticamente o userId a partir do JWT (UX sem campo manual)
  useEffect(() => {
    try {
      const token = getAccessToken();
      if (!token) return;
      const payload = decodeJwtPayload(token);
      const id = payload?.user?.id || payload?.id || payload?.sub;
      if (typeof id === 'string' && id.length > 0) {
        setUserId(id);
      }
    } catch {}
  }, []);

  // Campo removido: userId é carregado automaticamente pelo JWT

  // Simular depósito USDC que já dispara mint de CAPY
  const simulateUSDCDeposit = async () => {
    setError(null);
    setSimulateResult(null);
    setSimulateLoading(true);
    try {
      const amount = parseFloat(simulateAmountUSDC);
      if (!userId) throw new Error('Informe o ID do usuário ou use "Buscar meu ID".');
      if (Number.isNaN(amount) || amount <= 0) throw new Error('Informe um valor USDC válido.');

      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const res = await fetch(`${API_BASE}/api/payments/usdc/simulate-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount,
          description: simulateDesc,
          userAddress: walletAddress || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Falha ao simular depósito USDC');
      }
      setSimulateResult(json);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado na simulação');
    } finally {
      setSimulateLoading(false);
    }
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR')}`;
    } catch {
      return iso;
    }
  };

  const getTxExplorerUrl = (txHash?: string) => {
    if (!txHash) return null;
    const network = CONTRACT_CONFIG.chainId === 84532 ? 'testnet' : 'mainnet';
    const base = getBlockExplorerUrl(network);
    return `${base}/tx/${txHash}`;
  };

  const formatTxHash = (txHash?: string) => {
    if (!txHash || txHash.length < 20) return txHash || '';
    return `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
  };

  // Formata o valor do depósito considerando decimais do ativo (USDC = 6)
  const formatDepositAmount = (dep: any) => {
    const rawAmount = Number(dep?.amount ?? 0);
    const currency = String(dep?.currency ?? '').toUpperCase();
    const method = String(dep?.method ?? '').toLowerCase();

    const isUSDC = currency === 'USDC' || method === 'usdc';
    const decimals = isUSDC ? 6 : 2; // fallback genérico para não-USDC

    const value = isUSDC ? rawAmount / 1e6 : rawAmount;
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: isUSDC ? 6 : 2,
    }).format(value);

    return `${formatted} ${currency || (isUSDC ? 'USDC' : 'BRL')}`;
  };

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
        <h1 className="text-2xl font-bold text-capy-dark">Depósito de Cripto</h1>
        <div className="w-16"></div>
      </div>

      {/* Network Selection */}
      <div className="capy-card">
        <div className="flex items-center mb-4">
          <FiDownload className="w-5 h-5 text-capy-brown mr-2" />
          <h3 className="text-lg font-semibold text-capy-dark">Escolha a Rede</h3>
        </div>
        <select
          value={selectedNetwork}
          onChange={(e) => setSelectedNetwork(e.target.value as Network)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-capy-teal focus:border-transparent"
        >
          {Object.keys(networkAddresses).map((network) => (
            <option key={network} value={network}>
              {network}
            </option>
          ))}
        </select>
      </div>

      {/* Wallet Address */}
      <div className="capy-card">
        <h3 className="text-lg font-semibold text-capy-dark mb-2">Endereço da Carteira</h3>
        <div className="relative bg-gray-100 p-3 rounded-lg border border-gray-300">
          <code className="text-sm break-all block text-gray-700">
            {networkAddresses[selectedNetwork]}
          </code>
          <button
            onClick={handleCopy}
            className="absolute right-3 top-3 text-capy-teal hover:text-capy-dark-teal"
            title="Copiar endereço"
          >
            <FiCopy className="w-5 h-5" />
          </button>
        </div>

        {copied && (
          <div className="flex items-center text-green-700 text-sm mt-2">
            <FiCheckCircle className="w-4 h-4 mr-1" />
            Endereço copiado!
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="capy-card bg-yellow-50 border-yellow-200">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">Importante</h3>
        <ul className="text-yellow-700 text-sm space-y-1">
          <li>• Deposite somente o tipo de token compatível com a rede escolhida.</li>
          <li>• O crédito será identificado automaticamente após confirmação na blockchain.</li>
          <li>• Evite erros: depósitos em redes diferentes serão perdidos.</li>
        </ul>
      </div>

      {/* Lista de Depósitos do Usuário (apenas autenticado, sem campo de ID manual) */}
      <div className="capy-card">
        <div className="flex items-center mb-4">
          <FiSearch className="w-5 h-5 text-capy-brown mr-2" />
          <h3 className="text-lg font-semibold text-capy-dark">Depósitos do Usuário</h3>
        </div>
        {/* Ações: autenticado */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={fetchMyDeposits}
            disabled={loading}
            className="capy-button"
            aria-label="Buscar meus depósitos (autenticado)"
          >
            {loading ? 'Buscando...' : 'Buscar meus depósitos'}
          </button>
          <div className="text-xs text-gray-600 flex items-center">
            {userId ? 'ID carregado automaticamente via login' : 'Faça login para carregar seu ID automaticamente'}
          </div>
        </div>

        {/* Estados de erro */}
        {error && (
          <div className="flex items-center bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-3">
            <FiAlertTriangle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        )}

        {/* Lista de resultados */}
        {deposits.length === 0 && !loading && (
          <div className="text-sm text-gray-600">Nenhum depósito encontrado.</div>
        )}

        {deposits.length > 0 && (
          <div className="space-y-3">
            {deposits.map((dep, idx) => (
              <div key={dep.id ?? idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-capy-dark font-semibold">
                    {formatDepositAmount(dep)}
                  </div>
                  <span className={
                    `text-xs px-2 py-1 rounded ${dep.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : dep.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`
                  }>
                    {dep.status || 'STATUS'}
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  <div>Crédito: {formatDateTime(dep.credited_at)}</div>
                  <div>Método: {dep.method || '-'}</div>
                  <div>Transação: {dep.transaction_id || '-'}</div>
                  <div>ID: {dep.id || '-'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Simular Depósito USDC (dev) - aciona distribuição CAPY proporcional */}
      <div className="capy-card">
        <h3 className="text-lg font-semibold text-capy-dark mb-2">Simular Depósito USDC (dev)</h3>
        <p className="text-xs text-gray-600 mb-2">
          Use esta simulação para testes: registra um depósito em USDC e, se houver endereço do usuário, distribuirá CAPY proporcional ao valor em BRL.
        </p>
        <div className="flex flex-col gap-2">
          {/* ID do usuário carregado automaticamente via JWT; campo removido para UX */}
          <div className="text-xs text-gray-600">{userId ? 'ID detectado pelo login' : 'Faça login para detectar automaticamente seu ID'}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              value={simulateAmountUSDC}
              onChange={(e) => setSimulateAmountUSDC(e.target.value)}
              placeholder="Valor em USDC (ex: 1)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-capy-teal focus:border-transparent"
            />
            <input
              value={simulateDesc}
              onChange={(e) => setSimulateDesc(e.target.value)}
              placeholder="Descrição (opcional)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-capy-teal focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="Endereço do usuário para mint (0x...)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-capy-teal focus:border-transparent"
            />
            <div className="text-xs text-gray-600 flex items-center">{walletAddress ? 'Endereço carregado automaticamente' : 'Conecte-se para carregar o endereço automaticamente'}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={simulateUSDCDeposit} className="capy-button" disabled={simulateLoading}>
              {simulateLoading ? (
                <span className="flex items-center gap-2"><FiLoader className="animate-spin" /> Simulando...</span>
              ) : (
                'Simular depósito USDC'
              )}
            </button>
          </div>

          {simulateResult && (
            <div className="mt-3 p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm">
              <div className="font-semibold text-capy-dark mb-1">Resultado</div>
              <div className="text-gray-700">Mensagem: {simulateResult.message}</div>
              {simulateResult.conversion && (
                <div className="text-gray-700">Conversão USDC→BRL: {simulateResult.conversion.estimatedOutputBRZ} BRL (fonte: {simulateResult.conversion.source})</div>
              )}
              {simulateResult.capyMint && simulateResult.capyMint.success && (
                <div className="text-green-700">
                  {simulateResult.capyMint.mode === 'transfer' ? 'Transfer CAPY' : 'Mint CAPY'}: {simulateResult.capyMint.capyAmount} CAPY,
                  {' '}tx: <code className="font-mono">{formatTxHash(simulateResult.capyMint.txHash)}</code>
                  {(() => {
                    const url = getTxExplorerUrl(simulateResult.capyMint.txHash);
                    return url ? (
                      <>
                        {' '}(
                        <a href={url} target="_blank" rel="noopener noreferrer" className="underline text-capy-teal hover:text-capy-dark-teal">
                          ver no explorer
                        </a>
                        )
                      </>
                    ) : null;
                  })()}
                </div>
              )}
              {simulateResult.capyMint && simulateResult.capyMint.error && (
                <div className="text-red-700">Mint CAPY falhou: {simulateResult.capyMint.error}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
