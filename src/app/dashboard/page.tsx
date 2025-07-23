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
  FiLogOut
} from 'react-icons/fi';

export default function DashboardPage() {
  const router = useRouter();
  const [addressCopied, setAddressCopied] = useState<boolean>(false);

  // Dados simulados
  const mockWalletAddress = "0x1234...abcd";
  const mockBalance = 0.0425;
  const mockNetwork = "Base Sepolia";

  const copyAddress = async () => {
    try {
      if (typeof window !== 'undefined') {
        await navigator.clipboard.writeText("0x1234567890abcdef1234567890abcdef12345678");
        setAddressCopied(true);
        console.log('📋 Endereço simulado copiado');
        setTimeout(() => {
          setAddressCopied(false);
        }, 2000);
      }
    } catch (err) {
      console.error('Erro ao copiar endereço:', err);
    }
  };

  const handleLogout = () => {
    console.log('👋 Logout simulado');
    router.push('/');
  };

  return (
    <main className="animate-fade-in">
      {/* Header with title, welcome, and logout button */}
      <div className="flex justify-between items-center mb-8">
        <div className="text-center flex-1">
          <h1 className="text-4xl font-bold text-capy-dark mb-2">Capy Pay</h1>
          <p className="text-capy-dark/70 text-lg">
            Bem-vindo ao seu Dashboard!
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

      {/* Simulated wallet card */}
      <div className="capy-card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-capy-dark">Minha Carteira (Simulada)</h3>
          <div className="w-8 h-8 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">S</span>
          </div>
        </div>

        <div className="bg-capy-light rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-capy-dark/70 text-sm">Endereço:</span>
            <span className="text-xs text-gray-600 font-medium bg-gray-100 px-2 py-1 rounded">
              {mockNetwork}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="font-mono text-sm text-capy-dark">
                {mockWalletAddress} (Simulado)
              </div>
            </div>

            <button
              onClick={copyAddress}
              className={`ml-3 p-2 rounded-lg transition-all duration-200 ${
                addressCopied
                  ? 'bg-green-100 text-green-600'
                  : 'bg-white hover:bg-capy-teal/10 text-capy-brown hover:text-capy-teal'
              }`}
              title="Copiar endereço simulado"
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
          Carteira Simulada - Dados não reais
        </p>
      </div>

      {/* Main balance card */}
      <div className="capy-card mb-6">
        <div className="text-center">
          <p className="text-capy-dark/70 text-sm mb-2">Saldo da Carteira (Simulado)</p>

          <div className="flex items-center justify-center mb-4">
            <FiDollarSign className="w-8 h-8 text-capy-brown mr-2" />
            <div className="text-3xl font-bold text-capy-dark">
              {mockBalance.toLocaleString('pt-BR', {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4
              })} <span className="text-lg font-medium">ETH</span>
            </div>
          </div>

          <p className="text-capy-dark/60 text-sm">
            Saldo simulado na rede {mockNetwork}
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
          <div className="text-lg font-bold text-capy-success">Simulado</div>
          <p className="text-xs text-capy-dark/60">Modo de teste</p>
        </div>

        <div className="capy-card">
          <div className="flex items-center mb-2">
            <FiCreditCard className="w-5 h-5 text-capy-brown mr-2" />
            <span className="text-sm font-medium text-capy-dark">Rede</span>
          </div>
          <div className="text-lg font-bold text-capy-dark">{mockNetwork}</div>
          <p className="text-xs text-capy-dark/60">Blockchain de teste</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="capy-card">
        <h3 className="text-lg font-semibold text-capy-dark mb-4">Ações Rápidas</h3>
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