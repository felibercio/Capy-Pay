'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiUsers, FiShare2, FiCopy, FiCheckCircle, FiDollarSign, FiAward, FiGift } from 'react-icons/fi';

export default function ReferralPage() {
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Dados simulados do programa de referral
  const referralCode = "CAPY2025";
  const referralLink = `https://capypay.app/ref/${referralCode}`;
  const activeReferrals = 3;
  const totalEarnings = 125.50;
  const pendingEarnings = 45.00;

  // Dados dos indicados
  const referrals = [
    {
      name: "João Silva",
      joinDate: "15/01/2025",
      status: "Ativo",
      earnings: 25.00
    },
    {
      name: "Maria Santos",
      joinDate: "10/01/2025",
      status: "Ativo",
      earnings: 55.50
    },
    {
      name: "Pedro Lima",
      joinDate: "08/01/2025",
      status: "Pendente",
      earnings: 45.00
    }
  ];

  // Função para copiar o link de referral
  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setLinkCopied(true);
      console.log('🔗 Link de referral copiado!');
      
      // Remove o feedback visual após 2 segundos
      setTimeout(() => {
        setLinkCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Erro ao copiar link:', err);
    }
  };

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
            <FiUsers className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-capy-dark mb-2">Indique e Ganhe com Capy Pay</h1>
        <p className="text-capy-dark/70">Convide amigos e ganhe comissões</p>
      </div>

      {/* Card de resumo dos ganhos */}
      <div className="capy-card mb-6">
        <div className="text-center py-6">
          <h3 className="text-xl font-semibold text-capy-dark mb-6">Seus Ganhos com Indicações</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-capy-light rounded-xl p-4">
              <div className="flex items-center justify-center mb-2">
                <FiDollarSign className="w-5 h-5 text-capy-success mr-1" />
                <span className="text-2xl font-bold text-capy-success">
                  R$ {totalEarnings.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-capy-dark/60">Total Ganho</p>
            </div>
            
            <div className="bg-capy-light rounded-xl p-4">
              <div className="flex items-center justify-center mb-2">
                <FiUsers className="w-5 h-5 text-capy-brown mr-1" />
                <span className="text-2xl font-bold text-capy-dark">{activeReferrals}</span>
              </div>
              <p className="text-sm text-capy-dark/60">Indicados Ativos</p>
            </div>
          </div>

          {pendingEarnings > 0 && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-center justify-center">
                <FiGift className="w-5 h-5 text-orange-600 mr-2" />
                <span className="text-orange-800 font-medium">
                  R$ {pendingEarnings.toFixed(2)} pendentes de aprovação
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card do seu código de referral */}
      <div className="capy-card mb-6">
        <div className="py-6">
          <h3 className="text-xl font-semibold text-capy-dark mb-4 text-center">Seu Código de Indicação</h3>
          
          {/* Código de referral */}
          <div className="bg-capy-light rounded-xl p-6 mb-4 text-center">
            <div className="mb-4">
              <p className="text-capy-dark/70 text-sm mb-2">Seu código:</p>
              <div className="text-3xl font-bold text-capy-brown font-mono">
                {referralCode}
              </div>
            </div>
            
            {/* Link de referral */}
            <div className="mb-4">
              <p className="text-capy-dark/70 text-sm mb-2">Link de indicação:</p>
              <div className="bg-white rounded-lg p-3 border border-capy-teal/30">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-capy-dark truncate flex-1 mr-2">
                    {referralLink}
                  </span>
                  <button
                    onClick={copyReferralLink}
                    className={`p-2 rounded-lg transition-all duration-200 flex-shrink-0 ${
                      linkCopied 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-capy-teal/10 hover:bg-capy-teal/20 text-capy-brown'
                    }`}
                    title="Copiar link"
                  >
                    {linkCopied ? (
                      <FiCheckCircle className="w-4 h-4" />
                    ) : (
                      <FiCopy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={copyReferralLink}
              className="capy-button w-full"
            >
              <FiShare2 className="w-4 h-4 mr-2" />
              Compartilhar Link
            </button>
          </div>

          {/* Como funciona */}
          <div className="bg-gradient-to-r from-capy-teal/10 to-capy-brown/10 rounded-xl p-4 border border-capy-teal/20">
            <div className="text-center">
              <FiAward className="w-8 h-8 text-capy-brown mx-auto mb-2" />
              <p className="text-capy-dark font-medium mb-2">Como Funciona?</p>
              <div className="text-sm text-capy-dark/70 space-y-2">
                <p>🎯 Compartilhe seu código ou link com amigos</p>
                <p>💰 Ganhe 5% da comissão de cada transação deles</p>
                <p>🚀 Ganhos são creditados automaticamente</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de indicados */}
      <div className="capy-card mb-6">
        <h3 className="text-xl font-semibold text-capy-dark mb-4">Seus Indicados</h3>
        
        {referrals.length > 0 ? (
          <div className="space-y-3">
            {referrals.map((referral, index) => (
              <div key={index} className="bg-capy-light rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-capy-brown rounded-full flex items-center justify-center mr-3">
                      <span className="text-white font-bold text-sm">
                        {referral.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-capy-dark">{referral.name}</h4>
                      <p className="text-sm text-capy-dark/60">Cadastrou-se em {referral.joinDate}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium mb-1 ${
                      referral.status === 'Ativo' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {referral.status}
                    </div>
                    <div className="text-capy-success font-bold">
                      +R$ {referral.earnings.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FiUsers className="w-16 h-16 text-capy-dark/30 mx-auto mb-4" />
            <p className="text-capy-dark/60">Você ainda não indicou ninguém</p>
            <p className="text-sm text-capy-dark/50">Compartilhe seu código e comece a ganhar!</p>
          </div>
        )}
      </div>

      {/* Benefícios do programa */}
      <div className="capy-card mb-6">
        <h3 className="text-xl font-semibold text-capy-dark mb-4 text-center">Benefícios do Programa</h3>
        
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="w-2 h-2 bg-capy-success rounded-full mt-2 mr-4 flex-shrink-0"></div>
            <div>
              <h4 className="font-semibold text-capy-dark">5% de Comissão Vitalícia</h4>
              <p className="text-sm text-capy-dark/60">Ganhe para sempre uma porcentagem de todas as transações dos seus indicados</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="w-2 h-2 bg-capy-success rounded-full mt-2 mr-4 flex-shrink-0"></div>
            <div>
              <h4 className="font-semibold text-capy-dark">Pagamentos Automáticos</h4>
              <p className="text-sm text-capy-dark/60">Seus ganhos são creditados automaticamente na sua conta</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="w-2 h-2 bg-capy-success rounded-full mt-2 mr-4 flex-shrink-0"></div>
            <div>
              <h4 className="font-semibold text-capy-dark">Sem Limite de Indicações</h4>
              <p className="text-sm text-capy-dark/60">Indique quantos amigos quiser e multiplique seus ganhos</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="w-2 h-2 bg-capy-success rounded-full mt-2 mr-4 flex-shrink-0"></div>
            <div>
              <h4 className="font-semibold text-capy-dark">Bônus por Nível</h4>
              <p className="text-sm text-capy-dark/60">Quanto mais indicados ativos, maiores seus bônus especiais</p>
            </div>
          </div>
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
