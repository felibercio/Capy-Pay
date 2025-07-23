'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import TopMenu from '../../components/navigation/TopMenu';
import { 
  FiArrowLeft, 
  FiCreditCard, 
  FiDollarSign, 
  FiCheck,
  FiCopy,
  FiGrid,
  FiInfo,
  FiCheckCircle
} from 'react-icons/fi';

export default function PixPage() {
  const [pixValue, setPixValue] = useState('');
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [pixKey, setPixKey] = useState<string | null>(null);
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Dados simulados da conta
  const mockAccount = {
    pixKey: 'capypay@exemplo.com',
    accountName: 'Capy Pay Demo',
    bank: 'Banco Simulado',
    agency: '0001',
    account: '12345-6'
  };

  const generateQRCode = () => {
    if (!pixValue || parseFloat(pixValue) <= 0) {
      alert('Por favor, insira um valor válido');
      return;
    }

    setIsGenerating(true);
    console.log(`Gerando QR Code PIX para valor: R$ ${pixValue}`);

    // Simular delay de processamento
    setTimeout(() => {
      // Dados PIX simulados (formato simplificado)
      const pixData = {
        version: '01',
        pixKey: mockAccount.pixKey,
        merchantName: mockAccount.accountName,
        merchantCity: 'São Paulo',
        txId: `CAPY${Date.now()}`,
        amount: parseFloat(pixValue).toFixed(2),
        additionalInfo: 'Pagamento via Capy Pay'
      };

      // String PIX simplificada para o QR Code
      const qrString = `00020101021226580014BR.GOV.BCB.PIX0136${pixData.pixKey}5204000053039865802BR5913${pixData.merchantName}6009${pixData.merchantCity}62070503***6304`;
      
      setQrCodeData(qrString);
      setPixKey(pixData.pixKey);
      setIsGenerating(false);
      setPaymentReceived(false);
    }, 1500);
  };

  const simulatePaymentReceived = () => {
    console.log('Simulando recebimento do pagamento PIX...');
    setPaymentReceived(true);
    
    // Auto-limpar após 5 segundos
    setTimeout(() => {
      setQrCodeData(null);
      setPixKey(null);
      setPaymentReceived(false);
      setPixValue('');
    }, 5000);
  };

  const copyPixKey = async () => {
    if (pixKey) {
      try {
        await navigator.clipboard.writeText(pixKey);
        console.log('Chave PIX copiada:', pixKey);
      } catch (err) {
        console.error('Erro ao copiar chave PIX:', err);
      }
    }
  };

  const copyQRCode = async () => {
    if (qrCodeData) {
      try {
        await navigator.clipboard.writeText(qrCodeData);
        console.log('Dados do QR Code copiados');
      } catch (err) {
        console.error('Erro ao copiar QR Code:', err);
      }
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
        <h1 className="text-2xl font-bold text-capy-dark">PIX</h1>
        <div className="w-16"></div>
      </div>

      <TopMenu />

      {/* Main Content */}
      <div className="space-y-6">
        {/* Payment Value Input */}
        <div className="capy-card">
          <div className="flex items-center mb-4">
            <FiDollarSign className="w-5 h-5 text-capy-brown mr-2" />
            <h3 className="text-lg font-semibold text-capy-dark">Receber PIX</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-capy-dark mb-2">
                Valor do PIX (USDC)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  R$
                </span>
                <input
                  type="number"
                  placeholder="0,00"
                  value={pixValue}
                  onChange={(e) => setPixValue(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-capy-teal focus:border-transparent outline-none text-gray-700"
                  min="0"
                  step="0.01"
                  disabled={isGenerating || !!qrCodeData}
                />
              </div>
            </div>

            <button
              onClick={generateQRCode}
              disabled={isGenerating || !!qrCodeData || !pixValue}
              className={`w-full py-3 rounded-lg text-lg font-semibold transition-all duration-300 ${
                isGenerating
                  ? 'bg-gray-400 cursor-not-allowed text-gray-600'
                  : qrCodeData
                    ? 'bg-green-500 text-white cursor-not-allowed'
                    : pixValue && parseFloat(pixValue) > 0
                      ? 'bg-capy-teal text-white hover:bg-capy-dark-teal'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <span className="flex items-center justify-center">
                  <FiGrid className="w-5 h-5 mr-2 animate-spin" />
                  Gerando QR Code...
                </span>
              ) : qrCodeData ? (
                <span className="flex items-center justify-center">
                  <FiCheck className="w-5 h-5 mr-2" />
                  QR Code Gerado!
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <FiGrid className="w-5 h-5 mr-2" />
                  Gerar QR Code PIX
                </span>
              )}
            </button>
          </div>
        </div>

        {/* QR Code Display */}
        {qrCodeData && (
                     <div className="capy-card text-center">
             <div className="flex items-center justify-center mb-4">
               <FiGrid className="w-5 h-5 text-capy-brown mr-2" />
               <h3 className="text-lg font-semibold text-capy-dark">QR Code PIX</h3>
             </div>

            {paymentReceived ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center justify-center mb-4">
                  <FiCheckCircle className="w-16 h-16 text-green-600" />
                </div>
                <h4 className="text-xl font-bold text-green-800 mb-2">
                  Pagamento Recebido!
                </h4>
                <p className="text-green-700">
                  PIX de R$ {parseFloat(pixValue).toFixed(2)} foi recebido com sucesso.
                </p>
                <p className="text-sm text-green-600 mt-2">
                  Esta tela será limpa automaticamente...
                </p>
              </div>
            ) : (
              <>
                                 {/* QR Code */}
                 <div className="bg-white p-6 rounded-lg border border-gray-200 mb-4 inline-block">
                   <QRCodeSVG
                     value={qrCodeData}
                     size={200}
                   />
                 </div>

                {/* Payment Details */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor:</span>
                      <span className="font-medium text-capy-dark">R$ {parseFloat(pixValue).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Chave PIX:</span>
                      <div className="flex items-center">
                        <span className="font-medium text-capy-dark mr-2">{pixKey}</span>
                        <button
                          onClick={copyPixKey}
                          className="text-capy-teal hover:text-capy-dark-teal"
                          title="Copiar chave PIX"
                        >
                          <FiCopy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Favorecido:</span>
                      <span className="font-medium text-capy-dark">{mockAccount.accountName}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={simulatePaymentReceived}
                    className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                  >
                    <span className="flex items-center justify-center">
                      <FiCheckCircle className="w-5 h-5 mr-2" />
                      Simular Pagamento Recebido
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={copyQRCode}
                      className="py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                    >
                      <span className="flex items-center justify-center">
                        <FiCopy className="w-4 h-4 mr-1" />
                        Copiar Código
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setQrCodeData(null);
                        setPixKey(null);
                        setPixValue('');
                      }}
                      className="py-2 px-4 bg-red-200 text-red-700 rounded-lg hover:bg-red-300 transition-colors text-sm"
                    >
                      Cancelar PIX
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Account Info */}
        <div className="capy-card">
          <div className="flex items-center mb-4">
            <FiCreditCard className="w-5 h-5 text-capy-brown mr-2" />
            <h3 className="text-lg font-semibold text-capy-dark">Dados da Conta (Simulado)</h3>
          </div>

          <div className="bg-capy-light rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-capy-dark/70 text-sm">Chave PIX:</span>
              <span className="font-medium text-capy-dark text-sm">{mockAccount.pixKey}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-capy-dark/70 text-sm">Titular:</span>
              <span className="font-medium text-capy-dark text-sm">{mockAccount.accountName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-capy-dark/70 text-sm">Banco:</span>
              <span className="font-medium text-capy-dark text-sm">{mockAccount.bank}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-capy-dark/70 text-sm">Agência/Conta:</span>
              <span className="font-medium text-capy-dark text-sm">{mockAccount.agency} / {mockAccount.account}</span>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="capy-card bg-blue-50 border-blue-200">
          <div className="flex items-start">
            <FiInfo className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Como Usar</h3>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• Insira o valor que deseja receber</li>
                <li>• Clique em &quot;Gerar QR Code PIX&quot;</li>
                <li>• Compartilhe o QR Code com quem vai pagar</li>
                <li>• Use &quot;Simular Pagamento&quot; para testar o fluxo</li>
                <li>• Esta é uma simulação - nenhum PIX real será processado</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
