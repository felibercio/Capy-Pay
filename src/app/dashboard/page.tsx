'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TopMenu from '../../components/navigation/TopMenu';
import Image from 'next/image';
import { supabase } from '../../lib/supabaseClient';
import { capyCoinService } from '@/contracts/capyCoinService';
import {
  FiTrendingUp,
  FiDollarSign,
  FiCreditCard,
  FiFileText,
  FiCopy,
  FiCheckCircle
} from 'react-icons/fi';
// Temporário: remover dependência do OnchainKit até estabilizarmos versões

export default function DashboardPage() {
  const router = useRouter();
  const [addressCopied, setAddressCopied] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string>('Base');
  const [loadingWallet, setLoadingWallet] = useState<boolean>(true);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [capyBalance, setCapyBalance] = useState<number | null>(null);
  const [simulatedCapy, setSimulatedCapy] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false);
  const [showWalletCreated, setShowWalletCreated] = useState<boolean>(false);

  // Helper para ler cookies (fallback quando localStorage falhar)
  const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  };

  // Guard: exigir carteira vinculada (custodial via token ou não-custodial via address)
  useEffect(() => {
    const hydrateAndGuard = async () => {
      // Hidratar sessão do Supabase para compatibilizar com token existente
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (accessToken) {
          try {
            localStorage.setItem('accessToken', accessToken);
            document.cookie = `capypay_access_token=${accessToken}; path=/`;
          } catch {}
        }
      } catch {}

      const token = (() => {
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
      })();

      const localWalletAddress = (() => {
        try {
          return localStorage.getItem('walletAddress') || getCookie('wallet_address');
        } catch {
          return getCookie('wallet_address');
        }
      })();

      if (!token && !localWalletAddress) {
        router.push('/');
        return;
      }

      // Telemetria: primeiro acesso ao dashboard
      try {
        const firstAccessLogged = localStorage.getItem('firstAccessLogged');
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        if (!firstAccessLogged && token) {
          await fetch(`${API_BASE}/api/auth/telemetry/event`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ eventType: 'dashboard_first_access', source: 'dashboard' }),
          });
          localStorage.setItem('firstAccessLogged', '1');
        }
      } catch {}
    };

    hydrateAndGuard();
  }, [router]);

  useEffect(() => {
    let token = (() => {
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
    })();

    const loadWallet = async () => {
      // Se não houver token salvo, tentar obter sessão do Supabase
      if (!token) {
        try {
          const { data } = await supabase.auth.getSession();
          const supaToken = data?.session?.access_token;
          if (supaToken) {
            token = supaToken;
            try {
              localStorage.setItem('accessToken', supaToken);
              document.cookie = `capypay_access_token=${supaToken}; path=/`;
            } catch {}
          }
        } catch {}
      }

      // Se após tentar obter a sessão ainda não houver token, cair para endereço local (não-custodial)
      if (!token) {
        try {
          const localAddr = localStorage.getItem('walletAddress') || getCookie('wallet_address');
          if (localAddr) {
            setWalletAddress(localAddr);
          }
        } catch {}
        setLoadingWallet(false);
        return;
      }

      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const request = async () => fetch(`${API_BASE}/api/auth/wallet/address`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        let res = await request();
        let json: any = null;
        try { json = await res.json(); } catch {}

        // Retry com re-hidratação de sessão se falhar
        if (!(res.ok && json?.success)) {
          try {
            const { data } = await supabase.auth.getSession();
            const refreshed = data?.session?.access_token;
            if (refreshed) {
              token = refreshed;
              try {
                localStorage.setItem('accessToken', refreshed);
                document.cookie = `capypay_access_token=${refreshed}; path=/`;
              } catch {}
              res = await request();
              try { json = await res.json(); } catch {}
            }
          } catch {}
        }

        if (res.ok && json?.success) {
          setWalletAddress(json.data?.address ?? null);
          setNetwork(json.data?.network ?? 'Base');
          try { localStorage.setItem('walletAddress', json.data?.address ?? ''); } catch {}
          try { document.cookie = `wallet_address=${json.data?.address ?? ''}; path=/`; } catch {}

          // Exibir toast de criação de carteira no primeiro acesso
          try {
            const alreadyShown = localStorage.getItem('walletCreatedToastShown');
            if (json.data?.created && !alreadyShown) {
              setShowWalletCreated(true);
              localStorage.setItem('walletCreatedToastShown', '1');
              setTimeout(() => setShowWalletCreated(false), 4000);
            }
          } catch {}
        } else {
          // Fallback: usar endereço local, se existir
          try {
            const localAddr = localStorage.getItem('walletAddress') || getCookie('wallet_address');
            if (localAddr) {
              setWalletAddress(localAddr);
            }
          } catch {}
        }
      } catch (e) {
        console.error('Falha ao carregar endereço da carteira:', e);
      } finally {
        setLoadingWallet(false);
      }
    };

    loadWallet();
  }, []);

  // Fallback adicional: garantir que loadingWallet finalize após 1.5s
  useEffect(() => {
    const t = setTimeout(() => {
      setLoadingWallet(prev => (prev ? false : prev));
      if (!walletAddress) {
        const cookieAddr = getCookie('wallet_address');
        if (cookieAddr) setWalletAddress(cookieAddr);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [walletAddress]);

  // Listener para desconexão/metamask accountsChanged
  useEffect(() => {
    const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;
    if (!eth) return;

    const onAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        try {
          localStorage.removeItem('walletAddress');
          localStorage.removeItem('walletType');
        } catch {}
        router.push('/');
      } else {
        setWalletAddress(accounts[0]);
        try { localStorage.setItem('walletAddress', accounts[0]); } catch {}
      }
    };

    const onDisconnect = () => {
      try {
        localStorage.removeItem('walletAddress');
        localStorage.removeItem('walletType');
      } catch {}
      router.push('/');
    };

    eth.on?.('accountsChanged', onAccountsChanged);
    eth.on?.('disconnect', onDisconnect);

    return () => {
      eth.removeListener?.('accountsChanged', onAccountsChanged);
      eth.removeListener?.('disconnect', onDisconnect);
    };
  }, [router]);

  useEffect(() => {
    const fetchBalance = async () => {
      const token = (() => {
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
      })();

      if (!walletAddress || !token) return;
      setLoadingBalance(true);
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const res = await fetch(`${API_BASE}/api/auth/wallet/balance`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (res.ok && json.success && json.data?.balances?.ETH?.balance) {
          setEthBalance(json.data.balances.ETH.balance);
        }
        // Saldo CAPY (on-chain ou simulação) + depósitos simulados
        try {
          const walletCapyStr = await capyCoinService.getBalance(walletAddress);
          const walletCapy = walletCapyStr ? parseFloat(walletCapyStr) : 0;

          // Somar CAPY estimado das simulações (deposits)
          const depRes = await fetch(`${API_BASE}/api/deposits/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const depJson = await depRes.json();

          let simCapy = 0;
          if (depRes.ok && depJson.success && Array.isArray(depJson.data?.deposits)) {
            const rateOverride = Number(
              process.env.NEXT_PUBLIC_USDC_BRL_RATE_OVERRIDE ||
              process.env.NEXT_PUBLIC_USDC_BRL_RATE ||
              '5.3'
            );

            for (const dep of depJson.data.deposits) {
              const amount = Number(dep.amount || 0);
              const currency = String(dep.currency || '').toUpperCase();
              if (currency === 'BRL') {
                // amount em centavos → CAPY_PER_BRL=1
                simCapy += amount / 100;
              } else if (currency === 'USDC') {
                // amount em micro-USDC → converter para BRL via taxa override
                const usdc = amount / 1e6;
                simCapy += usdc * (Number.isNaN(rateOverride) ? 5.3 : rateOverride);
              }
            }
          }

          setSimulatedCapy(simCapy);
          setCapyBalance(walletCapy + simCapy);
        } catch (e) {
          console.error('Falha ao carregar saldo CAPY:', e);
        }
      } catch (e) {
        console.error('Falha ao carregar saldo da carteira:', e);
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [walletAddress]);

  const copyAddress = async () => {
    try {
      if (typeof window !== 'undefined' && walletAddress) {
        await navigator.clipboard.writeText(walletAddress);
        setAddressCopied(true);
        setTimeout(() => setAddressCopied(false), 2000);
      }
    } catch (err) {
      console.error('Erro ao copiar endereço:', err);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
      localStorage.removeItem('jwt');
      localStorage.removeItem('walletAddress');
      localStorage.removeItem('walletType');
      // Remover cookies relacionados
      document.cookie = 'wallet_connected=; Max-Age=0; path=/';
      document.cookie = 'wallet_address=; Max-Age=0; path=/';
      document.cookie = 'wallet_type=; Max-Age=0; path=/';
      document.cookie = 'capypay_access_token=; Max-Age=0; path=/';
    } catch {}
    router.push('/');
  };

  return (
    <main className="animate-fade-in">
      {/* Toast superior: carteira criada com sucesso */}
      {showWalletCreated && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded shadow-lg flex items-center gap-2">
          <FiCheckCircle className="text-white" />
          <span>Carteira criada com sucesso</span>
        </div>
      )}
      {/* Header with title, welcome, and logout button */}
      <div className="flex justify-between items-center mb-8" >
        <div className="flex justify-center mb-6">
          <Image
            src="/capy1.png"
            alt="Capy Pay Logo"
            width={120}
            height={120}
            priority={true}
            className="rounded-full"
          />
        </div>      

        <div className="text-center flex-1">
          <h1 className="text-4xl font-bold text-capy-dark mb-2">Capy Pay</h1>
        </div>

        {/* Wallet Status / Connect */}
        <div className="min-w-[280px] flex flex-col justify-end items-end gap-2">
          {walletAddress ? (
            <div className="flex gap-2">
              <Link href="/" prefetch={false} className="capy-button-secondary py-2 px-3 text-sm shadow-sm">Trocar carteira</Link>
              <button type="button" onClick={handleLogout} className="capy-button-secondary py-2 px-3 text-sm shadow-sm">Desconectar</button>
            </div>
          ) : (
            <Link href="/" prefetch={false} className="capy-button-secondary py-2 px-3 text-sm shadow-sm">Conectar carteira (Não-custodial)</Link>
          )}
          <span className="mt-1 text-xs text-gray-600">
            {loadingWallet
              ? 'Verificando sua carteira...'
              : walletAddress
                ? `Carteira vinculada • ${walletAddress.slice(0,6)}...${walletAddress.slice(-4)}`
                : 'Sem carteira vinculada'}
          </span>
        </div>
      </div>

      {/* Main navigation menu */}
      <TopMenu />

      {/* Wallet card */}
      <div className="capy-card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-capy-dark">Minha Carteira</h3>
          <div className="w-8 h-8 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">S</span>
          </div>
        </div>

        <div className="bg-capy-light rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-capy-dark/70 text-sm">Endereço:</span>
            <span className="text-xs text-gray-600 font-medium bg-gray-100 px-2 py-1 rounded">
              {network}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="font-mono text-sm text-capy-dark">
                {walletAddress ? (
                  `${walletAddress.slice(0,10)}...${walletAddress.slice(-8)}`
                ) : (
                  'Sem carteira vinculada'
                )}
              </div>
            </div>

            <button
              onClick={copyAddress}
              className={`ml-3 p-2 rounded-lg transition-all duration-200 ${
                addressCopied
                  ? 'bg-green-100 text-green-600'
                  : 'bg-white hover:bg-capy-teal/10 text-capy-brown hover:text-capy-teal'
              }`}
              title="Copiar endereço"
            >
              {addressCopied ? (
                <FiCheckCircle className="w-4 h-4" />
              ) : (
                <FiCopy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        {!walletAddress && (
          <p className="text-xs text-capy-dark/60 text-center">
            Dica: faça login com Google para vincular uma carteira automaticamente.
          </p>
        )}
      </div>

      {/* Main balance card */}
      <div className="capy-card mb-6">
        <div className="text-center">
          <p className="text-capy-dark/70 text-sm mb-2">Saldo CAPY</p>

          <div className="flex items-center justify-center mb-4">
            <FiDollarSign className="w-8 h-8 text-capy-brown mr-2" />
            <div className="text-3xl font-bold text-capy-dark">
              {loadingBalance
                ? 'Carregando...'
                : capyBalance !== null
                  ? `${Number(capyBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAPY`
                  : walletAddress
                    ? '—'
                    : 'Sem carteira'}
          </div>
        </div>

          <p className="text-capy-dark/60 text-sm">
            {walletAddress ? `Rede ${network}` : 'Conecte ou faça login para ver o saldo'}
          </p>
        </div>
      </div>

      {/* Quick info cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="capy-card">
          <div className="flex items-center mb-2">
            <FiTrendingUp className="w-5 h-5 text-capy-success mr-2" />
            <span className="text-sm font-medium text-capy-dark">Status</span>
          </div>
          <div className="text-lg font-bold text-capy-success">{walletAddress ? 'Ativo' : 'Desconectado'}</div>
          <p className="text-xs text-capy-dark/60">{walletAddress ? 'Carteira vinculada' : 'Faça login ou conecte uma carteira'}</p>
        </div>

        <div className="capy-card">
          <div className="flex items-center mb-2">
            <FiCreditCard className="w-5 h-5 text-capy-brown mr-2" />
            <span className="text-sm font-medium text-capy-dark">Rede</span>
          </div>
          <div className="text-lg font-bold text-capy-dark">{network}</div>
          <p className="text-xs text-capy-dark/60">{walletAddress ? 'Blockchain ativa' : 'Sem rede'}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="capy-card">
        <h3 className="text-lg font-semibold text-capy-dark mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/transactions"
            prefetch={false}
            className="capy-button-secondary py-3 text-sm flex items-center justify-center hover:bg-capy-brown hover:text-white transition-all duration-200"
          >
            <FiFileText className="w-4 h-4 mr-2" />
            Transações
          </Link>
          <Link
            href="/pix"
            prefetch={false}
            className="capy-button-secondary py-3 text-sm flex items-center justify-center hover:bg-capy-brown hover:text-white transition-all duration-200"
          >
            <FiCreditCard className="w-4 h-4 mr-2" />
            PIX
          </Link>
        </div>
      </div>

      {/* Info sobre simulação */}
      <div className="mt-6 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700 border border-yellow-200">
        <strong>🧪 Modo Simulação:</strong>
        <br />
        Todos os dados exibidos são simulados para demonstração. Nenhuma transação real será processada.
      </div>
    </main>
  );
}