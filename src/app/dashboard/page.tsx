// src/app/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TopMenu from '../../components/navigation/TopMenu';
import {
  FiTrendingUp,
  FiDollarSign,
  FiCreditCard,
  FiFileText,
  FiCopy,
  FiCheckCircle,
  FiLogOut,
  FiEdit3,
  FiLoader
} from 'react-icons/fi';
import { useWeb3Auth } from '@/context/Web3AuthContext';

export default function DashboardPage() {
  const router = useRouter();
  const {
    isLoggedIn,
    isLoading,
    isInitialized,
    walletInfo,
    logout,
    signMessage,
    error: contextError,
    getUserInfo
  } = useWeb3Auth();

  const [addressCopied, setAddressCopied] = useState<boolean>(false);
  const [userInfo, setUserInfo] = useState<any>(null);

  const [message, setMessage] = useState<string>('');
  const [signature, setSignature] = useState<string>('');
  const [signingLoading, setSigningLoading] = useState<boolean>(false);
  const [signError, setSignError] = useState<string | null>(null);

  // Redirecionar se não estiver logado
  useEffect(() => {
    if (isInitialized && !isLoggedIn) {
      console.warn('⚠️ Usuário não está logado, redirecionando para login...');
      router.push('/');
    }
  }, [isLoggedIn, isInitialized, router]);

  // Carregar informações do usuário
  useEffect(() => {
    const loadUserInfo = async () => {
      if (isLoggedIn && isInitialized) {
        try {
          const info = await getUserInfo();
          setUserInfo(info);
          console.log('👤 Informações do usuário carregadas:', info);
        } catch (err) {
          console.error('❌ Erro ao carregar informações do usuário:', err);
        }
      }
    };

    loadUserInfo();
  }, [isLoggedIn, isInitialized, getUserInfo]);

  const copyAddress = async () => {
    try {
      if (walletInfo?.address && typeof window !== 'undefined') {
        await navigator.clipboard.writeText(walletInfo.address);
        setAddressCopied(true);
        console.log('📋 Endereço copiado para a área de transferência');
        setTimeout(() => {
          setAddressCopied(false);
        }, 2000);
      }
    } catch (err) {
      console.error('Erro ao copiar endereço:', err);
    }
  };

  const handleSignMessage = async () => {
    if (!message.trim()) {
      setSignError('Por favor, digite uma mensagem para assinar');
      return;
    }
    try {
      setSigningLoading(true);
      setSignError(null);
      setSignature('');
      console.log('✍️ Assinando mensagem via contexto:', message);
      const sig = await signMessage(message);
      setSignature(sig);
      console.log('✅ Mensagem assinada com sucesso!');
      console.log('📝 Mensagem:', message);
      console.log('🖊️ Assinatura:', sig);
    } catch (err: any) {
      console.error('❌ Erro ao assinar mensagem:', err);
      if (err.message?.includes('User denied')) {
        setSignError('Assinatura cancelada pelo usuário');
      } else {
        setSignError(`Erro ao assinar mensagem: ${err.message || 'Erro desconhecido'}`);
      }
    } finally {
      setSigningLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      console.log('👋 Fazendo logout via contexto...');
      await logout();
      console.log('✅ Logout realizado com sucesso!');
      router.push('/');
    } catch (err) {
      console.error('❌ Erro ao fazer logout:', err);
      router.push('/');
    }
  };

  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copySignature = async () => {
    try {
      if (signature && typeof window !== 'undefined') {
        await navigator.clipboard.writeText(signature);
        console.log('📋 Assinatura copiada para a área de transferência');
      }
    } catch (err) {
      console.error('Erro ao copiar assinatura:', err);
    }
  };

  const getNetworkName = (chainId: number): string => {
    switch (chainId) {
      case 8453: return 'Base Mainnet';
      case 84532: return 'Base Sepolia';
      default: return `Chain ${chainId}`;
    }
  };

  // Loading state
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-capy-light-green">
        <div className="text-center">
          <FiLoader className="animate-spin w-8 h-8 text-capy-teal mb-4 mx-auto" />
          <p className="text-capy-dark">
            {!isInitialized ? 'Inicializando Web3Auth...' : 'Carregando dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  // Redirect if not logged in
  if (!isLoggedIn) {
    return null;
  }

  const balance = walletInfo ? parseFloat(walletInfo.balance) : 0;

  return (
    <main className="animate-fade-in">
      {/* Header with title, welcome, and logout button */}
      <div className="flex justify-between items-center mb-8">
        <div className="text-center flex-1">
          <h1 className="text-4xl font-bold text-capy-dark mb-2">Capy Pay</h1>
          <p className="text-capy-dark/70 text-lg">
            Bem-vindo ao seu Dashboard Web3!
            {userInfo?.name && (
              <span className="block text-sm text-capy-teal mt-1">
                👋 Olá, {userInfo.name}!
              </span>
            )}
          </p>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-all duration-200"
          title="Fazer Logout"
        >
          <FiLogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>

      {/* Main navigation menu */}
      <TopMenu />

      {/* Context error, if any */}
      {contextError && (
        <div className="capy-card mb-6 bg-red-50 border-red-200">
          <div className="text-red-700">
            <strong>❌ Erro do Web3Auth:</strong>
            <p className="text-sm mt-1">{contextError}</p>
          </div>
        </div>
      )}

      {/* Web3Auth wallet card */}
      {walletInfo && (
        <div className="capy-card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-capy-dark">Minha Carteira EVM</h3>
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">W3</span>
            </div>
          </div>

          <div className="bg-capy-light rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-capy-dark/70 text-sm">Endereço:</span>
              <span className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-1 rounded">
                {getNetworkName(walletInfo.chainId)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-mono text-sm text-capy-dark break-all">
                  {walletInfo.address}
                </div>
                <div className="text-xs text-capy-dark/60 mt-1">
                  Truncado: {formatAddress(walletInfo.address)}
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

          <p className="text-xs text-capy-dark/60 text-center">
            Carteira via Web3Auth Context - Chain ID: {walletInfo.chainId}
          </p>
        </div>
      )}

      {/* Main balance card */}
      <div className="capy-card mb-6">
        <div className="text-center">
          <p className="text-capy-dark/70 text-sm mb-2">Saldo da Carteira</p>

          <div className="flex items-center justify-center mb-4">
            <FiDollarSign className="w-8 h-8 text-capy-brown mr-2" />
            <div className="text-3xl font-bold text-capy-dark">
              {balance.toLocaleString('pt-BR', {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4
              })} <span className="text-lg font-medium">ETH</span>
            </div>
          </div>

          <p className="text-capy-dark/60 text-sm">
            Saldo da carteira na rede {walletInfo ? getNetworkName(walletInfo.chainId) : 'Base'}
          </p>
        </div>
      </div>

      {/* Sign Message Card */}
      <div className="capy-card mb-6">
        <div className="flex items-center mb-4">
          <FiEdit3 className="w-5 h-5 text-capy-brown mr-2" />
          <h3 className="text-lg font-semibold text-capy-dark">Assinar Mensagem</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-capy-dark mb-2">
              Mensagem para assinar:
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite sua mensagem aqui..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-capy-teal focus:border-transparent outline-none text-capy-dark"
              rows={3}
              disabled={signingLoading}
            />
          </div>

          <button
            onClick={handleSignMessage}
            disabled={signingLoading || !message.trim()}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all duration-200 ${
              signingLoading || !message.trim()
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-capy-teal hover:bg-capy-dark-teal text-white'
            }`}
          >
            {signingLoading ? (
              <>
                <FiLoader className="animate-spin w-4 h-4" />
                Assinando mensagem...
              </>
            ) : (
              <>
                <FiEdit3 className="w-4 h-4" />
                Assinar Mensagem
              </>
            )}
          </button>

          {signError && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {signError}
            </div>
          )}

          {signature && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-capy-dark">
                Assinatura gerada:
              </label>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="font-mono text-xs text-green-800 break-all mb-2">
                  {signature}
                </div>
                <button
                  onClick={copySignature}
                  className="text-green-600 hover:text-green-800 text-sm flex items-center gap-1"
                >
                  <FiCopy className="w-3 h-3" />
                  Copiar assinatura
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick info cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="capy-card">
          <div className="flex items-center mb-2">
            <FiTrendingUp className="w-5 h-5 text-capy-success mr-2" />
            <span className="text-sm font-medium text-capy-dark">Transações</span>
          </div>
          <div className="text-lg font-bold text-capy-success">Web3</div>
          <p className="text-xs text-capy-dark/60">Habilitadas</p>
        </div>

        <div className="capy-card">
          <div className="flex items-center mb-2">
            <FiCreditCard className="w-5 h-5 text-capy-brown mr-2" />
            <span className="text-sm font-medium text-capy-dark">Rede</span>
          </div>
          <div className="text-lg font-bold text-capy-dark">
            {walletInfo ? getNetworkName(walletInfo.chainId) : 'Base'}
          </div>
          <p className="text-xs text-capy-dark/60">Blockchain</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="capy-card">
        <h3 className="text-lg font-semibold text-capy-dark mb-4">Ações Web3</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/transactions"
            className="capy-button-secondary py-3 text-sm flex items-center justify-center hover:bg-capy-brown hover:text-white transition-all duration-200"
          >
            <FiFileText className="w-4 h-4 mr-2" />
            Transações
          </Link>
          <Link
            href="/pix"
            className="capy-button-secondary py-3 text-sm flex items-center justify-center hover:bg-capy-brown hover:text-white transition-all duration-200"
          >
            <FiCreditCard className="w-4 h-4 mr-2" />
            PIX Web3
          </Link>
        </div>
      </div>
    </main>
  );
} 