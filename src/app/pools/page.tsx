'use client';

import React from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiDroplet, FiBarChart, FiZap, FiUsers } from 'react-icons/fi';

export default function PoolsPage() {
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
            <FiDroplet className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-capy-dark mb-2">Pools de Liquidez</h1>
        <p className="text-capy-dark/70">Forneça liquidez e ganhe taxas</p>
      </div>

      {/* Card principal */}
      <div className="capy-card text-center mb-6">
        <div className="py-8">
          <div className="mb-6">
            <div className="w-24 h-24 bg-capy-light rounded-full flex items-center justify-center mx-auto mb-4">
              <FiBarChart className="w-12 h-12 text-capy-brown" />
            </div>
          </div>
          
          <h2 className="text-xl font-semibold text-capy-dark mb-4">
            Explore as pools de liquidez disponíveis aqui!
          </h2>
          
          <p className="text-capy-dark/60 mb-8 leading-relaxed">
            Forneça liquidez para os pares de tokens e ganhe <br />
            uma porcentagem das taxas de negociação.
          </p>

          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-center text-capy-dark/70">
              <div className="w-2 h-2 bg-capy-success rounded-full mr-3"></div>
              <span className="text-sm">Ganhe taxas de negociação</span>
            </div>
            <div className="flex items-center justify-center text-capy-dark/70">
              <div className="w-2 h-2 bg-capy-success rounded-full mr-3"></div>
              <span className="text-sm">Liquidez 24/7</span>
            </div>
            <div className="flex items-center justify-center text-capy-dark/70">
              <div className="w-2 h-2 bg-capy-success rounded-full mr-3"></div>
              <span className="text-sm">Múltiplos pares disponíveis</span>
            </div>
          </div>

          {/* Pools populares fictícias */}
          <div className="space-y-3 mb-6">
            <h3 className="font-semibold text-capy-dark text-left">Pools Populares</h3>
            
            <div className="bg-capy-light rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex -space-x-2 mr-3">
                    <div className="w-8 h-8 bg-capy-teal rounded-full flex items-center justify-center text-white text-xs font-bold">
                      U
                    </div>
                    <div className="w-8 h-8 bg-capy-brown rounded-full flex items-center justify-center text-white text-xs font-bold">
                      B
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-capy-dark">USDC/BRL</p>
                    <p className="text-sm text-capy-dark/60">TVL: $1.2M</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-capy-success">8.5%</p>
                  <p className="text-xs text-capy-dark/60">APY</p>
                </div>
              </div>
            </div>

            <div className="bg-capy-light rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex -space-x-2 mr-3">
                    <div className="w-8 h-8 bg-capy-brown rounded-full flex items-center justify-center text-white text-xs font-bold">
                      B
                    </div>
                    <div className="w-8 h-8 bg-capy-teal rounded-full flex items-center justify-center text-white text-xs font-bold">
                      C
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-capy-dark">BRZ/CAPY</p>
                    <p className="text-sm text-capy-dark/60">TVL: $890K</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-capy-success">12.3%</p>
                  <p className="text-xs text-capy-dark/60">APY</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats gerais */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-capy-teal/20">
              <div className="flex items-center justify-center mb-2">
                <FiUsers className="w-5 h-5 text-capy-brown mr-1" />
                <span className="text-2xl font-bold text-capy-dark">1.2K</span>
              </div>
              <p className="text-sm text-capy-dark/60">Provedores</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-capy-teal/20">
              <div className="flex items-center justify-center mb-2">
                <FiZap className="w-5 h-5 text-capy-brown mr-1" />
                <span className="text-2xl font-bold text-capy-dark">$4.5M</span>
              </div>
              <p className="text-sm text-capy-dark/60">TVL Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="space-y-3">
        <button className="capy-button w-full">
          Explorar Pools
        </button>
        <Link href="/dashboard" className="capy-button-secondary w-full text-center block">
          Voltar ao Dashboard
        </Link>
      </div>
    </main>
  );
}
