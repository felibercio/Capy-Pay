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
  const [showBRcapyInfo, setShowBRcapyInfo] = useState(false);

  const stakingPools = [
    {
      id: 'capy-eth',
      name: 'CAPY-ETH LP',
      apy: '24.5',
      tvl: '1.2M',
      userStaked: '0.00',
      description: 'Ajude a plataforma oferecendo liquidez para CAPY e ETH, e ganhe recompensas diárias.'
    },
    {
      id: 'capy-base',
      name: 'CAPY Staking',
      apy: '18.2',
      tvl: '850K',
      userStaked: '125.50',
      description: 'Guarde seus CAPY aqui e receba rendimento diário como forma de incentivo.'
    },
    {
      id: 'eth-vault',
      name: 'ETH Vault',
      apy: '12.8',
      tvl: '2.1M',
      userStaked: '0.00',
      description: 'Deixe seu ETH trabalhando em estratégias seguras e automatizadas.'
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
        <Link href="/dashboard" className="flex items-center text-capy-dark hover:text-capy-teal transition-colors">
          <FiArrowLeft className="w-5 h-5 mr-2" />
          Voltar
        </Link>
        <h1 className="text-2xl font-bold text-capy-dark">Pools e Investimentos</h1>
        <div className="w-16" />
      </div>

      {/* Pools de Liquidez */}
      {/* ... mantém a seção anterior como está ... */}

      {/* Pools de Staking */}
      <div className="capy-card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-capy-dark">Pools de Staking</h3>
          <span className="text-sm text-capy-dark/70">Em breve!!</span>
        </div>

      </div>

      {/* Modal de Stake */}
      {selectedPool && (
        <div className="capy-card bg-blue-50 border-blue-200 mb-6 ">
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
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${stakeAmount && parseFloat(stakeAmount) > 0
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
      {/* <div className="capy-card bg-yellow-50 border-yellow-200 mb-6">
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
      </div> */}

      {/* Formulário de Staking BRcapy+ */}
      <div className="bg-white border border-capy-dark/10 rounded-xl p-6 mt-4">
        <h4 className="text-lg font-semibold text-capy-dark mb-3">🚀 Adesão ao BRcapy+</h4>

        <p className="text-sm text-capy-dark/70 mb-4">
          Faça staking de BRZ e receba BRcapy+ na proporção <strong>1:1</strong>.
          Os tokens BRZ ficam alocados em ativos de renda fixa e você passa a participar da valorização do protocolo.
        </p>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-capy-dark">Quantidade de BRZ para Staking</label>
          <input
            type="number"
            placeholder="0.00"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-capy-teal"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setStakeAmount('100')}
              className="px-3 py-1 text-sm bg-capy-light text-capy-dark rounded hover:bg-capy-teal/10"
            >
              100 BRZ
            </button>
            <button
              onClick={() => setStakeAmount('500')}
              className="px-3 py-1 text-sm bg-capy-light text-capy-dark rounded hover:bg-capy-teal/10"
            >
              500 BRZ
            </button>
          </div>

          <button
            onClick={() => {
              console.log(`Staking de ${stakeAmount} BRZ → recebendo BRcapy+`);
              setStakeAmount('');
            }}
            disabled={!stakeAmount || parseFloat(stakeAmount) <= 0}
            className={`w-full py-3 rounded-lg font-semibold transition-colors ${stakeAmount && parseFloat(stakeAmount) > 0
              ? 'bg-capy-teal text-white hover:bg-capy-dark-teal'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
          >
            Confirmar Staking
          </button>
        </div>
      </div>

      {/* BRcapy+ - O Token de Rendimento do Capy Pay */}
      <div className="capy-card bg-capy-light/30 border border-capy-dark/10 mb-6 mt-6">
        <div className="flex items-start mb-4">
          <FiTrendingUp className="w-6 h-6 text-capy-dark mr-3 mt-1" />
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-capy-dark mb-2">
              🪙 BRcapy+ — O Token de Rendimento do Capy Pay
            </h3>
            <p className="text-capy-dark/70 text-sm leading-relaxed mb-4">
              O BRcapy+ permite que você participe dos rendimentos gerados pelo app Capy Pay.
            </p>

            <button
              onClick={() => setShowBRcapyInfo(prev => !prev)}
              className="text-capy-light text-sm font-medium hover:underline mb-4"
            >
              {showBRcapyInfo ? 'Ocultar detalhes' : 'Saiba mais sobre como funciona'}
            </button>

            {showBRcapyInfo && (
              <div className="transition-all duration-300 ease-in-out">
                <p className="text-capy-dark/70 text-sm leading-relaxed mb-4">
                  <strong>BRcapy+</strong> é uma <em>yieldcoin</em> do ecossistema Capy Pay, <strong>lastreada na receita do protocolo</strong> e no rendimento equivalente ao <strong>CDI</strong>.
                </p>

                <h4 className="text-base font-semibold text-capy-dark mb-2 mt-4">🔧 Como Funciona o BRcapy+</h4>
                <ol className="list-decimal pl-5 space-y-2 text-sm text-capy-dark/80 mb-4">
                  <li><strong>Staking de BRZ:</strong> Você faz stake de BRZ e recebe BRcapy+ (1:1).</li>
                  <li><strong>Rendimento Base:</strong> BRZ é investido em renda fixa tokenizada que acompanha o CDI.</li>
                  <li><strong>Receita do Protocolo:</strong> Parte das taxas do app vai para o cofre do BRcapy+.</li>
                </ol>

                <h4 className="text-base font-semibold text-capy-dark mb-2 mt-4">📈 Por que o BRcapy+ se valoriza?</h4>
                <ul className="list-disc pl-5 text-sm text-capy-dark/80 space-y-1 mb-4">
                  <li>📊 Rendimento externo via CDI</li>
                  <li>💰 Receita do app Capy Pay (ex: 30% da taxa de boleto)</li>
                  <li>🔁 Uso crescente do app → mais valor no cofre</li>
                </ul>

                <p className="text-capy-dark/70 text-sm mb-4">
                  BRcapy+ começa valendo 1:1 com BRZ, mas se valoriza ao longo do tempo.
                </p>

                <h4 className="text-base font-semibold text-capy-dark mb-2 mt-4">🎯 Resumo da Lógica</h4>
                <div className="overflow-auto mb-4">
                  <table className="min-w-full text-sm text-capy-dark border border-capy-dark/10 rounded-lg">
                    <thead className="bg-white font-semibold">
                      <tr>
                        <th className="px-4 py-2 border-b">Ação do Usuário</th>
                        <th className="px-4 py-2 border-b">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white/70">
                        <td className="px-4 py-2 border-b">Staking de BRZ</td>
                        <td className="px-4 py-2 border-b">Recebe BRcapy+</td>
                      </tr>
                      <tr className="bg-white/60">
                        <td className="px-4 py-2 border-b">BRcapy+ rendendo</td>
                        <td className="px-4 py-2 border-b">CDI + Receita do protocolo</td>
                      </tr>
                      <tr className="bg-white/70">
                        <td className="px-4 py-2">Desstaking</td>
                        <td className="px-4 py-2">Recebe BRZ + rendimento acumulado</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </main>
  );
}
