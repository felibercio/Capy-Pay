'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiDroplet,
  FiBarChart,
  FiZap,
  FiUsers,
  FiTrendingUp,
  FiDollarSign,
  FiPercent,
  FiPlusCircle,
  FiMinusCircle,
  FiInfo
} from 'react-icons/fi';

export default function PoolsUnificadasPage() {
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');

  const stakingPools = [
    {
      id: 'capy-eth',
      name: 'CAPY-ETH LP',
      apy: '24.5',
      tvl: '1.2M',
      userStaked: '0.00',
      description: 'Pool de liquidez CAPY-ETH com rewards em CAPY tokens'
    },
    {
      id: 'capy-base',
      name: 'CAPY Staking',
      apy: '18.2',
      tvl: '850K',
      userStaked: '125.50',
      description: 'Stake seus tokens CAPY e receba recompensas diárias'
    },
    {
      id: 'eth-vault',
      name: 'ETH Vault',
      apy: '12.8',
      tvl: '2.1M',
      userStaked: '0.00',
      description: 'Vault de ETH com estratégias automatizadas'
    }
  ];

  const handleStake = (poolId: string) => {
    console.log(`Fazendo stake de ${stakeAmount} no pool ${poolId} (simulado)`);
    setSelectedPool(null);
    setStakeAmount('');
  };

  const handleUnstake = (poolId: string) => {
    console.log(`Fazendo unstake do pool ${poolId} (simulado)`);
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
        <h1 className="text-2xl font-bold text-capy-dark">Pools e Investimentos</h1>
        <div className="w-16" />
      </div>

      {/* Pools de Liquidez */}
      <div className="capy-card text-center mb-6">
        <div className="py-8">
          <div className="w-24 h-24 bg-capy-light rounded-full flex items-center justify-center mx-auto mb-4">
            <FiBarChart className="w-12 h-12 text-capy-brown" />
          </div>
          <h2 className="text-xl font-semibold text-capy-dark mb-4">
            Explore as pools de liquidez disponíveis aqui!
          </h2>
          <p className="text-capy-dark/60 mb-8 leading-relaxed">
            Forneça liquidez para os pares de tokens e ganhe <br />
            uma porcentagem das taxas de negociação.
          </p>

          <div className="space-y-3 mb-6 text-left">
            <h3 className="font-semibold text-capy-dark">Pools Populares</h3>
            <div className="bg-capy-light rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex -space-x-2 mr-3">
                    <div className="w-8 h-8 bg-capy-info rounded-full text-white text-xs font-bold flex items-center justify-center">U</div>
                    <div className="w-8 h-8 bg-capy-brown rounded-full text-white text-xs font-bold flex items-center justify-center">B</div>
                  </div>
                  <div>
                    <p className="font-medium text-capy-dark">USDC/BRZ</p>
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
                    <div className="w-8 h-8 bg-capy-info rounded-full text-white text-xs font-bold flex items-center justify-center">E</div>
                    <div className="w-8 h-8 bg-capy-info rounded-full text-white text-xs font-bold flex items-center justify-center">U</div>
                  </div>
                  <div>
                    <p className="font-medium text-capy-dark">EURC/USDC</p>
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

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-capy-teal/20 text-center">
              <div className="flex items-center justify-center mb-2">
                <FiUsers className="w-5 h-5 text-capy-brown mr-1" />
                <span className="text-2xl font-bold text-capy-dark">1.2K</span>
              </div>
              <p className="text-sm text-capy-dark/60">Provedores</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-capy-teal/20 text-center">
              <div className="flex items-center justify-center mb-2">
                <FiZap className="w-5 h-5 text-capy-brown mr-1" />
                <span className="text-2xl font-bold text-capy-dark">$4.5M</span>
              </div>
              <p className="text-sm text-capy-dark/60">TVL Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Staking Pools */}
      <div className="capy-card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-capy-dark">Pools de Staking</h3>
          <span className="text-sm text-capy-dark/70">APY anualizado</span>
        </div>

        <div className="space-y-4">
          {stakingPools.map(pool => (
            <div key={pool.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-capy-dark">{pool.name}</h4>
                  <p className="text-sm text-capy-dark/70">{pool.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-capy-success">{pool.apy}% APY</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div><p className="text-sm text-capy-dark/70">TVL</p><p className="font-medium text-capy-dark">${pool.tvl}</p></div>
                <div><p className="text-sm text-capy-dark/70">Meu Stake</p><p className="font-medium text-capy-dark">{pool.userStaked} CAPY</p></div>
                <div><p className="text-sm text-capy-dark/70">Rewards</p><p className="font-medium text-green-600">~R$ 12,34/dia</p></div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setSelectedPool(pool.id)} className="flex-1 flex items-center justify-center px-4 py-2 bg-capy-teal text-white rounded-lg hover:bg-capy-dark-teal transition-colors">
                  <FiPlusCircle className="w-4 h-4 mr-2" /> Stake
                </button>
                {parseFloat(pool.userStaked) > 0 && (
                  <button onClick={() => handleUnstake(pool.id)} className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                    <FiMinusCircle className="w-4 h-4 mr-2" /> Unstake
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Stake */}
      {selectedPool && (
        <div className="capy-card bg-blue-50 border-blue-200 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-blue-800">
              Fazer Stake - {stakingPools.find(p => p.id === selectedPool)?.name}
            </h3>
            <button onClick={() => setSelectedPool(null)} className="text-blue-600 hover:text-blue-800">✕</button>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-blue-800 mb-2">Quantidade de CAPY</label>
            <input
              type="number"
              placeholder="0.00"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStakeAmount('50')} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200">50 CAPY</button>
              <button onClick={() => setStakeAmount('100')} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200">100 CAPY</button>
            </div>
            <button
              onClick={() => handleStake(selectedPool)}
              disabled={!stakeAmount || parseFloat(stakeAmount) <= 0}
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                stakeAmount && parseFloat(stakeAmount) > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Confirmar Stake
            </button>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="capy-card bg-yellow-50 border-yellow-200 mb-6">
        <div className="flex items-start">
          <FiInfo className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Sobre Investimentos</h3>
            <ul className="text-yellow-700 text-sm space-y-1">
              <li>• Os rendimentos são calculados automaticamente</li>
              <li>• Você pode fazer unstake a qualquer momento</li>
              <li>• APY pode variar baseado na performance do pool</li>
              <li>• Esta é uma simulação - valores não são reais</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
