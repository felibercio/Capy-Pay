'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiShield, FiTrendingUp, FiCheckCircle, FiAlertCircle, FiUser, FiFileText } from 'react-icons/fi';

export default function LimitKYCPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [kycLevel, setKycLevel] = useState('basic');
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Dados simulados do usuário
  const currentLimit = kycLevel === 'basic' ? 5000 : kycLevel === 'verified' ? 25000 : 100000;
  const nextLimit = kycLevel === 'basic' ? 25000 : kycLevel === 'verified' ? 100000 : null;
  
  const handleUpgradeKYC = () => {
    setIsProcessing(true);
    
    // Simula processo de KYC
    setTimeout(() => {
      setIsProcessing(false);
      setShowSuccess(true);
      
      // Simula upgrade do nível após alguns segundos
      setTimeout(() => {
        if (kycLevel === 'basic') {
          setKycLevel('verified');
        } else if (kycLevel === 'verified') {
          setKycLevel('premium');
        }
        setShowSuccess(false);
      }, 2000);
    }, 3000);
  };

  const getLevelInfo = (level: string) => {
    switch (level) {
      case 'basic':
        return {
          name: 'Básico',
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          icon: FiUser,
          requirements: 'Apenas email verificado'
        };
      case 'verified':
        return {
          name: 'Verificado',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          icon: FiFileText,
          requirements: 'Documentos pessoais validados'
        };
      case 'premium':
        return {
          name: 'Premium',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          icon: FiCheckCircle,
          requirements: 'Verificação completa + comprovante de renda'
        };
      default:
        return getLevelInfo('basic');
    }
  };

  const levelInfo = getLevelInfo(kycLevel);

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
            <FiShield className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-capy-dark mb-2">Gerenciar Limite Diário e KYC</h1>
        <p className="text-capy-dark/70">Aumente seus limites com verificação</p>
      </div>

      {/* Status atual */}
      <div className="capy-card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-capy-dark">Status Atual</h2>
          <div className={`px-3 py-1 rounded-full ${levelInfo.bgColor} flex items-center`}>
            <levelInfo.icon className={`w-4 h-4 mr-2 ${levelInfo.color}`} />
            <span className={`text-sm font-medium ${levelInfo.color}`}>
              Nível {levelInfo.name}
            </span>
          </div>
        </div>
        
        <div className="bg-capy-light rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-capy-dark/70">Limite Diário:</span>
            <span className="text-2xl font-bold text-capy-dark">
              R$ {currentLimit.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-capy-dark/70">Utilizado hoje:</span>
            <span className="text-capy-dark font-medium">R$ 1.200,00 (24%)</span>
          </div>
          
          {/* Barra de progresso */}
          <div className="mt-3 bg-white rounded-full h-2">
            <div className="bg-capy-brown h-2 rounded-full" style={{ width: '24%' }}></div>
          </div>
        </div>
        
        <p className="text-sm text-capy-dark/60">
          {levelInfo.requirements}
        </p>
      </div>

      {/* Próximo nível */}
      {nextLimit && (
        <div className="capy-card mb-6">
          <h3 className="text-lg font-semibold text-capy-dark mb-4">
            Próximo Nível Disponível
          </h3>
          
          <div className="bg-gradient-to-r from-capy-teal/10 to-capy-brown/10 rounded-xl p-4 border border-capy-teal/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-capy-dark font-medium">Novo limite diário:</span>
              <span className="text-2xl font-bold text-capy-success">
                R$ {nextLimit.toLocaleString('pt-BR')}
              </span>
            </div>
            
            <div className="flex items-center mb-3">
              <FiTrendingUp className="w-4 h-4 text-capy-success mr-2" />
              <span className="text-sm text-capy-success font-medium">
                +{Math.round(((nextLimit - currentLimit) / currentLimit) * 100)}% de aumento
              </span>
            </div>
            
            <div className="text-sm text-capy-dark/60">
              Requer verificação adicional de documentos
            </div>
          </div>
        </div>
      )}

      {/* Processo de upgrade */}
      <div className="capy-card mb-6">
        <h3 className="text-lg font-semibold text-capy-dark mb-4">
          Aumentar Limite
        </h3>
        
        {isProcessing ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-capy-brown mx-auto mb-4"></div>
            <h4 className="text-lg font-semibold text-capy-dark mb-2">
              Iniciando processo de KYC...
            </h4>
            <p className="text-capy-dark/60">
              Verificando seus documentos e informações
            </p>
          </div>
        ) : showSuccess ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiCheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h4 className="text-lg font-semibold text-capy-dark mb-2">
              Verificação Concluída!
            </h4>
            <p className="text-capy-dark/60">
              Seu limite foi atualizado com sucesso
            </p>
          </div>
        ) : kycLevel === 'premium' ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiCheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h4 className="text-lg font-semibold text-capy-dark mb-2">
              Nível Máximo Atingido
            </h4>
            <p className="text-capy-dark/60">
              Você possui o maior limite disponível
            </p>
          </div>
        ) : (
          <div>
            <div className="bg-capy-light rounded-xl p-4 mb-4">
              <div className="flex items-start">
                <FiAlertCircle className="w-5 h-5 text-capy-brown mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-capy-dark mb-1">
                    Processo de Verificação
                  </h4>
                  <p className="text-sm text-capy-dark/60 leading-relaxed">
                    Para aumentar seu limite, precisamos verificar alguns documentos. 
                    O processo é rápido e seguro, levando apenas alguns minutos.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center">
                <FiCheckCircle className="w-4 h-4 text-capy-success mr-3" />
                <span className="text-sm text-capy-dark">Documento de identidade</span>
              </div>
              <div className="flex items-center">
                <FiCheckCircle className="w-4 h-4 text-capy-success mr-3" />
                <span className="text-sm text-capy-dark">Comprovante de endereço</span>
              </div>
              <div className="flex items-center">
                <FiCheckCircle className="w-4 h-4 text-capy-success mr-3" />
                <span className="text-sm text-capy-dark">Selfie para verificação</span>
              </div>
            </div>
            
            <button 
              onClick={handleUpgradeKYC}
              className="capy-button w-full"
              disabled={isProcessing}
            >
              Aumentar Limite
            </button>
          </div>
        )}
      </div>

      {/* Botão voltar */}
      <div className="mt-6">
        <Link href="/dashboard" className="capy-button-secondary w-full text-center block">
          Voltar ao Dashboard
        </Link>
      </div>
    </main>
  );
}
