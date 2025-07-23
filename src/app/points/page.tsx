'use client';

import React from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiStar, FiAward, FiTrendingUp, FiGift, FiUsers, FiCreditCard } from 'react-icons/fi';

export default function PointsPage() {
  // Dados simulados do usuário
  const userLevel = "Capivara Iniciante";
  const currentPoints = 1250;
  const nextLevelPoints = 2500;
  const progress = (currentPoints / nextLevelPoints) * 100;
  
  // Formas de ganhar pontos
  const pointsActivities = [
    {
      icon: FiCreditCard,
      activity: "Transações PIX",
      points: "10 pontos",
      description: "Por cada transação realizada"
    },
    {
      icon: FiUsers,
      activity: "Indicar Amigos",
      points: "100 pontos",
      description: "Por cada amigo que se cadastrar"
    },
    {
      icon: FiTrendingUp,
      activity: "Staking BRZ",
      points: "5 pontos/dia",
      description: "Por manter tokens em staking"
    },
    {
      icon: FiGift,
      activity: "Login Diário",
      points: "2 pontos",
      description: "Por acessar o app todos os dias"
    }
  ];

  // Níveis disponíveis
  const levels = [
    { name: "Capivara Iniciante", minPoints: 0, color: "text-gray-600", bgColor: "bg-gray-100" },
    { name: "Capivara Explorador", minPoints: 2500, color: "text-blue-600", bgColor: "bg-blue-100" },
    { name: "Capivara Comerciante", minPoints: 5000, color: "text-green-600", bgColor: "bg-green-100" },
    { name: "Capivara Investidor", minPoints: 10000, color: "text-purple-600", bgColor: "bg-purple-100" },
    { name: "Capivara Lendário", minPoints: 25000, color: "text-yellow-600", bgColor: "bg-yellow-100" }
  ];

  const getCurrentLevel = () => {
    return levels.find(level => currentPoints >= level.minPoints && currentPoints < (levels[levels.indexOf(level) + 1]?.minPoints || Infinity)) || levels[0];
  };

  const getNextLevel = () => {
    const currentLevelIndex = levels.findIndex(level => level.name === getCurrentLevel().name);
    return levels[currentLevelIndex + 1] || null;
  };

  const currentLevelInfo = getCurrentLevel();
  const nextLevel = getNextLevel();

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
            <FiStar className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-capy-dark mb-2">Meus Pontos Capy Pay</h1>
        <p className="text-capy-dark/70">Sistema de recompensas e níveis</p>
      </div>

      {/* Card de pontos atual */}
      <div className="capy-card mb-6">
        <div className="text-center py-6">
          <div className="flex justify-center mb-4">
            <div className={`px-4 py-2 rounded-full ${currentLevelInfo.bgColor} flex items-center`}>
              <FiAward className={`w-5 h-5 mr-2 ${currentLevelInfo.color}`} />
              <span className={`font-semibold ${currentLevelInfo.color}`}>
                {currentLevelInfo.name}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-4xl font-bold text-capy-dark mb-2">
              {currentPoints.toLocaleString('pt-BR')} <span className="text-lg font-medium text-capy-brown">CapyPoints</span>
            </div>
            
            {nextLevel && (
              <>
                <p className="text-capy-dark/60 mb-4">
                  {(nextLevel.minPoints - currentPoints).toLocaleString('pt-BR')} pontos para {nextLevel.name}
                </p>
                
                {/* Barra de progresso */}
                <div className="w-full bg-capy-light rounded-full h-3 mb-2">
                  <div 
                    className="bg-gradient-to-r from-capy-teal to-capy-brown h-3 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-capy-dark/60">
                  {progress.toFixed(1)}% para o próximo nível
                </p>
              </>
            )}
          </div>

          {nextLevel && (
            <div className="bg-capy-light rounded-xl p-4">
              <h3 className="font-semibold text-capy-dark mb-2">Próximo Nível</h3>
              <div className={`px-3 py-2 rounded-full ${nextLevel.bgColor} inline-flex items-center`}>
                <FiAward className={`w-4 h-4 mr-2 ${nextLevel.color}`} />
                <span className={`font-medium ${nextLevel.color}`}>{nextLevel.name}</span>
              </div>
              <p className="text-sm text-capy-dark/60 mt-2">
                Benefícios exclusivos e mais recompensas!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Como ganhar pontos */}
      <div className="capy-card mb-6">
        <h3 className="text-xl font-semibold text-capy-dark mb-6 text-center">Como Ganhar Pontos</h3>
        
        <div className="space-y-4">
          {pointsActivities.map((activity, index) => (
            <div key={index} className="bg-capy-light rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mr-4">
                    <activity.icon className="w-6 h-6 text-capy-brown" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-capy-dark">{activity.activity}</h4>
                    <p className="text-sm text-capy-dark/60">{activity.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-capy-success text-lg">{activity.points}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-gradient-to-r from-capy-teal/10 to-capy-brown/10 rounded-xl border border-capy-teal/20">
          <div className="text-center">
            <FiGift className="w-8 h-8 text-capy-brown mx-auto mb-2" />
            <p className="text-capy-dark font-medium mb-1">Dica Especial!</p>
            <p className="text-sm text-capy-dark/70">
              Use o app diariamente e convide amigos para acelerar sua progressão nos níveis.
            </p>
          </div>
        </div>
      </div>

      {/* Todos os níveis */}
      <div className="capy-card mb-6">
        <h3 className="text-xl font-semibold text-capy-dark mb-4 text-center">Todos os Níveis</h3>
        
        <div className="space-y-3">
          {levels.map((level, index) => (
            <div 
              key={index} 
              className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                level.name === currentLevelInfo.name 
                  ? 'border-capy-brown bg-capy-light' 
                  : 'border-gray-200 bg-white hover:border-capy-teal/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`px-3 py-2 rounded-full ${level.bgColor} flex items-center mr-4`}>
                    <FiAward className={`w-4 h-4 mr-2 ${level.color}`} />
                    <span className={`font-medium ${level.color} text-sm`}>{level.name}</span>
                  </div>
                  {level.name === currentLevelInfo.name && (
                    <span className="bg-capy-success text-white text-xs px-2 py-1 rounded-full font-medium">
                      Nível Atual
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-capy-dark font-semibold">
                    {level.minPoints.toLocaleString('pt-BR')}+ pts
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Botão de ação */}
      <div className="mt-6">
        <Link href="/dashboard" className="capy-button-secondary w-full text-center block">
          Voltar ao Dashboard
        </Link>
      </div>
    </main>
  );
}
