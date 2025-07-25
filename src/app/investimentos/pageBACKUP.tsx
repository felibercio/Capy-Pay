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
      <div className="capy-card bg-capy-light/30 border border-capy-dark/10 mb-6">
        <div className="flex items-start mb-4">
          <FiTrendingUp className="w-6 h-6 text-capy-dark mr-3 mt-1" />
          <div>
            <h3 className="text-xl font-semibold text-capy-dark mb-4">
              🪙 BRcapy+ — O Token de Rendimento do Capy Pay
            </h3>

            <p className="text-capy-dark/70 text-sm leading-relaxed mb-4">
              <strong>BRcapy+</strong> é uma <em>yieldcoin</em> (token de rendimento) do ecossistema Capy Pay, <strong>lastreada na receita gerada pelo próprio protocolo</strong> e no rendimento equivalente ao <strong>CDI</strong>.
            </p>

            <h4 className="text-base font-semibold text-capy-dark mb-2 mt-4">🔧 Como Funciona o BRcapy+</h4>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-capy-dark/80 mb-4">
              <li>
                <strong>Staking de BRZ:</strong> Usuários interessados em rendimento fazem <strong>staking de BRZ</strong> dentro do Capy Pay. Em troca, recebem <strong>BRcapy+ na proporção 1:1</strong> (inicialmente), que representa sua participação no pool de rendimento.
              </li>
              <li>
                <strong>Rendimento Base (CDI):</strong> O BRZ em staking é alocado em <em>ativos de renda fixa tokenizados</em> que acompanham o CDI.
                <br />
                Exemplos: Tesouro Direto (via Liqi, MB Tokens), Agrotokens, FIDC tokenizados, DEXs com stable yield (Credix, TrueFi, etc).
              </li>
              <li>
                <strong>Receita do Protocolo:</strong> Parte das taxas do Capy Pay (ex: boleto, swap, cartão) também vai para a <strong>tesouraria do BRcapy+</strong>, aumentando seu valor com o tempo.
              </li>
            </ol>

            <h4 className="text-base font-semibold text-capy-dark mb-2 mt-4">📈 Por que o BRcapy+ se valoriza?</h4>
            <ul className="list-disc pl-5 text-sm text-capy-dark/80 space-y-1 mb-4">
              <li>📊 <strong>Rendimentos externos</strong> (CDI via tokens de renda fixa)</li>
              <li>💰 <strong>Taxas do app Capy Pay</strong> (ex: 30% da taxa de boleto vai para a tesouraria)</li>
              <li>🔁 <strong>Alta utilização do app</strong> (quanto mais usuários, maior o valor acumulado)</li>
            </ul>

            <p className="text-capy-dark/70 text-sm mb-4">
              O BRcapy+ deixa de valer <strong>1:1 com o BRZ</strong> e passa a valer <strong>mais</strong>, refletindo esse crescimento.
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
        </div>
      </div>


    </main>
  );
}
