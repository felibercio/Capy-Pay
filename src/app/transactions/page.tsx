'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiList, FiArrowUpRight, FiArrowDownLeft, FiCreditCard, FiFileText, FiTrendingUp, FiCheckCircle, FiClock, FiAlertCircle } from 'react-icons/fi';

export default function TransactionsPage() {
  const [filter, setFilter] = useState('all');
  
  // Dados simulados de transações
  const transactions = [
    {
      id: 1,
      type: 'Base Pay',
      category: 'recebimento',
      description: 'Recebimento via Base Pay',
      amount: 50.00,
      currency: 'USDC',
      amountBRL: 250.00,
      date: '2025-01-21',
      time: '14:30',
      status: 'Concluída',
      hash: '0x1a2b3c...',
      icon: FiArrowDownLeft,
      colorClass: 'text-capy-success'
    },
    {
      id: 2,
      type: 'PIX',
      category: 'envio',
      description: 'Transferência PIX para João Silva',
      amount: 120.00,
      currency: 'BRL',
      date: '2025-01-21',
      time: '09:15',
      status: 'Concluída',
      icon: FiArrowUpRight,
      colorClass: 'text-red-600'
    },
    {
      id: 3,
      type: 'Staking BRZ',
      category: 'staking',
      description: 'Recompensa de Staking BRZ',
      amount: 15.50,
      currency: 'BRZ',
      date: '2025-01-20',
      time: '12:00',
      status: 'Concluída',
      icon: FiTrendingUp,
      colorClass: 'text-capy-success'
    },
    {
      id: 4,
      type: 'Boleto',
      category: 'pagamento',
      description: 'Pagamento de Boleto - Energia Elétrica',
      amount: 185.75,
      currency: 'BRL',
      date: '2025-01-19',
      time: '16:45',
      status: 'Concluída',
      icon: FiFileText,
      colorClass: 'text-red-600'
    },
    {
      id: 5,
      type: 'PIX',
      category: 'recebimento',
      description: 'PIX recebido de Maria Santos',
      amount: 75.00,
      currency: 'BRL',
      date: '2025-01-19',
      time: '11:20',
      status: 'Concluída',
      icon: FiArrowDownLeft,
      colorClass: 'text-capy-success'
    },
    {
      id: 6,
      type: 'Base Pay',
      category: 'envio',
      description: 'Pagamento Base Pay pendente',
      amount: 25.00,
      currency: 'USDC',
      amountBRL: 125.00,
      date: '2025-01-18',
      time: '20:10',
      status: 'Pendente',
      hash: '0x4d5e6f...',
      icon: FiArrowUpRight,
      colorClass: 'text-orange-600'
    },
    {
      id: 7,
      type: 'Referral',
      category: 'recebimento',
      description: 'Comissão de indicação - Pedro Lima',
      amount: 12.50,
      currency: 'BRL',
      date: '2025-01-18',
      time: '08:30',
      status: 'Concluída',
      icon: FiArrowDownLeft,
      colorClass: 'text-capy-success'
    }
  ];

  // Filtrar transações
  const filteredTransactions = transactions.filter(transaction => {
    if (filter === 'all') return true;
    if (filter === 'recebimento') return transaction.category === 'recebimento';
    if (filter === 'envio') return transaction.category === 'envio' || transaction.category === 'pagamento';
    if (filter === 'staking') return transaction.category === 'staking';
    return true;
  });

  // Obter ícone de status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Concluída':
        return <FiCheckCircle className="w-4 h-4 text-green-600" />;
      case 'Pendente':
        return <FiClock className="w-4 h-4 text-orange-600" />;
      case 'Falhada':
        return <FiAlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <FiClock className="w-4 h-4 text-gray-600" />;
    }
  };

  // Formatar data
  const formatDate = (date: string, time: string) => {
    const [year, month, day] = date.split('-');
    return `${day}/${month} às ${time}`;
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
            <FiList className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-capy-dark mb-2">Histórico de Transações</h1>
        <p className="text-capy-dark/70">Acompanhe todas suas movimentações</p>
      </div>

      {/* Filtros */}
      <div className="capy-card mb-6">
        <div className="flex items-center justify-center">
          <div className="bg-capy-light rounded-xl p-2 inline-flex">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                filter === 'all' 
                  ? 'bg-white text-capy-brown shadow-sm' 
                  : 'text-capy-dark hover:text-capy-brown'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilter('recebimento')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                filter === 'recebimento' 
                  ? 'bg-white text-capy-brown shadow-sm' 
                  : 'text-capy-dark hover:text-capy-brown'
              }`}
            >
              Recebidas
            </button>
            <button
              onClick={() => setFilter('envio')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                filter === 'envio' 
                  ? 'bg-white text-capy-brown shadow-sm' 
                  : 'text-capy-dark hover:text-capy-brown'
              }`}
            >
              Enviadas
            </button>
            <button
              onClick={() => setFilter('staking')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                filter === 'staking' 
                  ? 'bg-white text-capy-brown shadow-sm' 
                  : 'text-capy-dark hover:text-capy-brown'
              }`}
            >
              Staking
            </button>
          </div>
        </div>
      </div>

      {/* Resumo rápido */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="capy-card">
          <div className="flex items-center mb-2">
            <FiArrowDownLeft className="w-5 h-5 text-capy-success mr-2" />
            <span className="text-sm font-medium text-capy-dark">Recebido</span>
          </div>
          <div className="text-lg font-bold text-capy-success">R$ 402,50</div>
          <p className="text-xs text-capy-dark/60">Este mês</p>
        </div>

        <div className="capy-card">
          <div className="flex items-center mb-2">
            <FiArrowUpRight className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-sm font-medium text-capy-dark">Enviado</span>
          </div>
          <div className="text-lg font-bold text-red-600">R$ 430,75</div>
          <p className="text-xs text-capy-dark/60">Este mês</p>
        </div>
      </div>

      {/* Lista de transações */}
      <div className="capy-card">
        <h3 className="text-xl font-semibold text-capy-dark mb-4">
          Transações Recentes ({filteredTransactions.length})
        </h3>
        
        {filteredTransactions.length > 0 ? (
          <div className="space-y-3">
            {filteredTransactions.map((transaction) => (
              <div key={transaction.id} className="bg-capy-light rounded-xl p-4 hover:bg-white transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mr-4">
                      <transaction.icon className={`w-6 h-6 ${transaction.colorClass}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <h4 className="font-semibold text-capy-dark mr-2">{transaction.type}</h4>
                        {getStatusIcon(transaction.status)}
                      </div>
                      <p className="text-sm text-capy-dark/70 mb-1">{transaction.description}</p>
                      <div className="flex items-center text-xs text-capy-dark/50">
                        <span>{formatDate(transaction.date, transaction.time)}</span>
                        {transaction.hash && (
                          <>
                            <span className="mx-2">•</span>
                            <span className="font-mono">{transaction.hash}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-lg font-bold ${transaction.colorClass} ${
                      transaction.category === 'recebimento' || transaction.category === 'staking' ? '' : ''
                    }`}>
                      {transaction.category === 'recebimento' || transaction.category === 'staking' ? '+' : '-'}
                      {transaction.currency === 'BRL' ? 'R$ ' : ''}
                      {transaction.amount.toFixed(2)} {transaction.currency !== 'BRL' ? transaction.currency : ''}
                    </div>
                    {transaction.amountBRL && transaction.currency !== 'BRL' && (
                      <div className="text-xs text-capy-dark/60">
                        ≈ R$ {transaction.amountBRL.toFixed(2)}
                      </div>
                    )}
                    <div className={`text-xs font-medium mt-1 ${
                      transaction.status === 'Concluída' ? 'text-green-600' :
                      transaction.status === 'Pendente' ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {transaction.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FiList className="w-16 h-16 text-capy-dark/30 mx-auto mb-4" />
            <p className="text-capy-dark/60">Nenhuma transação encontrada</p>
            <p className="text-sm text-capy-dark/50">Use os filtros para encontrar transações específicas</p>
          </div>
        )}
      </div>

      {/* Informações adicionais */}
      <div className="capy-card mt-6">
        <div className="text-center py-4">
          <h4 className="font-semibold text-capy-dark mb-2">Precisa de Ajuda?</h4>
          <p className="text-sm text-capy-dark/60 mb-4">
            Se você tiver dúvidas sobre alguma transação, entre em contato conosco.
          </p>
          <div className="flex justify-center space-x-3">
            <button className="capy-button-secondary text-sm px-4 py-2">
              Suporte
            </button>
            <button className="capy-button-secondary text-sm px-4 py-2">
              Exportar PDF
            </button>
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
