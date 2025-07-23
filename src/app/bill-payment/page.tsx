'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import TopMenu from '../../components/navigation/TopMenu';
import { 
  FiArrowLeft, 
  FiFileText, 
  FiDollarSign, 
  FiCalendar,
  FiCheck,
  FiCopy
} from 'react-icons/fi';

export default function BillPaymentPage() {
  const [barcode, setBarcode] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentProcessed, setPaymentProcessed] = useState(false);

  const handlePayment = () => {
    console.log('Processando pagamento de boleto (simulado)');
    setPaymentProcessed(true);
    setTimeout(() => {
      setPaymentProcessed(false);
    }, 3000);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setBarcode(text);
      console.log('Código de barras colado:', text);
    } catch (err) {
      console.error('Erro ao colar:', err);
    }
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
        <h1 className="text-2xl font-bold text-capy-dark">Pagar Boleto</h1>
        <div className="w-16"></div>
      </div>

      {/* <TopMenu /> */}

      {/* Main Content */}
      <div className="space-y-6">
        {/* Barcode Input */}
        <div className="capy-card">
          <div className="flex items-center mb-4">
            <FiFileText className="w-5 h-5 text-capy-brown mr-2" />
            <h3 className="text-lg font-semibold text-capy-dark">Código de Barras</h3>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Digite ou cole o código de barras"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-capy-teal focus:border-transparent outline-none text-gray-700 pr-12"
              />
              <button
                onClick={pasteFromClipboard}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-capy-teal hover:text-capy-dark-teal"
                title="Colar da área de transferência"
              >
                <FiCopy className="w-4 h-4" />
              </button>
            </div>

            {barcode && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-green-700 text-sm">
                  ✅ Código de barras detectado: {barcode.substring(0, 20)}...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Details */}
        {barcode && (
          <div className="capy-card">
            <h3 className="text-lg font-semibold text-capy-dark mb-4">Detalhes do Pagamento</h3>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <FiDollarSign className="w-5 h-5 text-capy-brown mr-3" />
                <div className="flex-1">
                  <label className="block text-sm font-medium text-capy-dark mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-capy-teal focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <FiCalendar className="w-5 h-5 text-capy-brown mr-3" />
                <div className="flex-1">
                  <label className="block text-sm font-medium text-capy-dark mb-1">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-capy-teal focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Button */}
        {barcode && amount && dueDate && (
          <div className="capy-card">
            <button
              onClick={handlePayment}
              disabled={paymentProcessed}
              className={`w-full py-4 rounded-lg text-lg font-semibold transition-all duration-300 ${
                paymentProcessed
                  ? 'bg-green-500 text-white cursor-not-allowed'
                  : 'bg-capy-teal text-white hover:bg-capy-dark-teal'
              }`}
            >
              {paymentProcessed ? (
                <span className="flex items-center justify-center">
                  <FiCheck className="w-5 h-5 mr-2" />
                  Pagamento Processado!
                </span>
              ) : (
                `Pagar R$ ${amount}`
              )}
            </button>

            <p className="text-xs text-gray-500 text-center mt-3">
              Esta é uma simulação - nenhum pagamento real será processado
            </p>
          </div>
        )}

        {/* Info Card */}
        <div className="capy-card bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">Como Funciona</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• Cole ou digite o código de barras do boleto</li>
            <li>• Confirme o valor e data de vencimento</li>
            <li>• Clique em &quot;Pagar&quot; para processar (simulação)</li>
            <li>• O pagamento será processado via cripto automaticamente</li>
          </ul>
        </div>
      </div>
    </main>
  );
} 