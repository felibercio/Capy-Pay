'use client';

import React from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiWifi, FiShield, FiCheck, FiArrowRight } from 'react-icons/fi';

export default function ConnectWalletPage() {
  const walletOptions = [
    {
      id: 'metamask',
      name: 'MetaMask',
      description: 'Conectar com MetaMask',
      icon: '🦊',
      popular: true
    },
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      description: 'Escanear com carteira mobile',
      icon: '📱',
      popular: false
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      description: 'Conectar com Coinbase',
      icon: '🔵',
      popular: false
    }
  ];

  return (
    <main className="animate-fade-in">
      {/* Header com botão voltar */}
      <div className="flex items-center justify-between mb-8">
        <Link 
          href="/dashboard" 
          className="flex items-center text-capy-dark hover:text-capy-brown transition-colors duration-200"
        >
          <FiArrowLeft className="w-6 h-6 mr-2" />
          <span className="font-medium">Voltar</span>
        </Link>
      </div>

      {/* Título da página */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-capy-brown rounded-full flex items-center justify-center">
            <FiWifi className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-capy-dark mb-2">Conectar Carteira</h1>
        <p className="text-capy-dark/70">Conecte sua carteira Web3</p>
      </div>

      {/* Card principal */}
      <div className="capy-card mb-6">
        <div className="text-center py-6">
          <h2 className="text-xl font-semibold text-capy-dark mb-4">
            Conecte sua carteira Web3 para começar!
          </h2>
          
          <p className="text-capy-dark/60 mb-8 leading-relaxed">
            Conecte sua carteira para acessar todas as funcionalidades <br />
            do Capy Pay de forma segura e descentralizada.
          </p>

          {/* Benefícios */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-center text-capy-dark/70">
              <div className="w-2 h-2 bg-capy-success rounded-full mr-3"></div>
              <span className="text-sm">Acesso completo ao DeFi</span>
            </div>
            <div className="flex items-center justify-center text-capy-dark/70">
              <div className="w-2 h-2 bg-capy-success rounded-full mr-3"></div>
              <span className="text-sm">Controle total dos seus assets</span>
            </div>
            <div className="flex items-center justify-center text-capy-dark/70">
              <div className="w-2 h-2 bg-capy-success rounded-full mr-3"></div>
              <span className="text-sm">Transações seguras</span>
            </div>
          </div>
        </div>
      </div>

      {/* Opções de carteira */}
      <div className="space-y-3 mb-6">
        <h3 className="font-semibold text-capy-dark mb-4">Escolha sua carteira</h3>
        
        {walletOptions.map((wallet) => (
          <button
            key={wallet.id}
            className="w-full p-4 bg-white border-2 border-capy-teal/20 rounded-xl hover:border-capy-brown hover:shadow-capy transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-capy-light rounded-xl flex items-center justify-center text-2xl mr-4">
                  {wallet.icon}
                </div>
                <div className="text-left">
                  <div className="flex items-center">
                    <h4 className="font-semibold text-capy-dark mr-2">{wallet.name}</h4>
                    {wallet.popular && (
                      <span className="bg-capy-brown text-white text-xs px-2 py-1 rounded-full">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-capy-dark/60">{wallet.description}</p>
                </div>
              </div>
              <FiArrowRight className="w-5 h-5 text-capy-brown" />
            </div>
          </button>
        ))}
      </div>

      {/* Informações de segurança */}
      <div className="bg-capy-light rounded-xl p-4 mb-6">
        <div className="flex items-start">
          <FiShield className="w-5 h-5 text-capy-brown mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-capy-dark mb-1">Segurança Garantida</h4>
            <p className="text-sm text-capy-dark/60 leading-relaxed">
              Nunca compartilhamos suas chaves privadas. Suas transações são processadas 
              diretamente pela sua carteira de forma segura e descentralizada.
            </p>
          </div>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="space-y-3">
        <Link href="/dashboard" className="capy-button-secondary w-full text-center block">
          Continuar sem carteira
        </Link>
      </div>
    </main>
  );
}
