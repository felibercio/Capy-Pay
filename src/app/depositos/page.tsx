'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  FiArrowLeft, 
  FiDownload, 
  FiCopy, 
  FiCheckCircle 
} from 'react-icons/fi';

// Primeiro declare as redes possíveis como um tipo
type Network = 'Base' |'Ethereum' | 'Polygon' | 'Solana';

const networkAddresses: Record<Network, string> = {
  Base: '0x7Fb3E9812a1c3a0Bd724e70C59798EfF682C25f9',
  Ethereum: '0xABCD1234EF567890ABCDEF1234567890ABCDEF01',
  Polygon: '0x1234EFAB5678CD901234567890ABCDEF1234EFAB',
  Solana: '8fE9qBzA2sxy3Fv9dPd8QmBtPvWtwKvGHuh5NKuE2y9T'
};

export default function CryptoDepositPage() {
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('Ethereum'); // <- tipo Network
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const address = networkAddresses[selectedNetwork]; // agora está tipado corretamente
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <h1 className="text-2xl font-bold text-capy-dark">Depósito de Cripto</h1>
        <div className="w-16"></div>
      </div>

      {/* Network Selection */}
      <div className="capy-card">
        <div className="flex items-center mb-4">
          <FiDownload className="w-5 h-5 text-capy-brown mr-2" />
          <h3 className="text-lg font-semibold text-capy-dark">Escolha a Rede</h3>
        </div>
        <select
          value={selectedNetwork}
          onChange={(e) => setSelectedNetwork(e.target.value as Network)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-capy-teal focus:border-transparent"
        >
          {Object.keys(networkAddresses).map((network) => (
            <option key={network} value={network}>
              {network}
            </option>
          ))}
        </select>
      </div>

      {/* Wallet Address */}
      <div className="capy-card">
        <h3 className="text-lg font-semibold text-capy-dark mb-2">Endereço da Carteira</h3>
        <div className="relative bg-gray-100 p-3 rounded-lg border border-gray-300">
          <code className="text-sm break-all block text-gray-700">
            {networkAddresses[selectedNetwork]}
          </code>
          <button
            onClick={handleCopy}
            className="absolute right-3 top-3 text-capy-teal hover:text-capy-dark-teal"
            title="Copiar endereço"
          >
            <FiCopy className="w-5 h-5" />
          </button>
        </div>

        {copied && (
          <div className="flex items-center text-green-700 text-sm mt-2">
            <FiCheckCircle className="w-4 h-4 mr-1" />
            Endereço copiado!
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="capy-card bg-yellow-50 border-yellow-200">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">Importante</h3>
        <ul className="text-yellow-700 text-sm space-y-1">
          <li>• Deposite somente o tipo de token compatível com a rede escolhida.</li>
          <li>• O crédito será identificado automaticamente após confirmação na blockchain.</li>
          <li>• Evite erros: depósitos em redes diferentes serão perdidos.</li>
        </ul>
      </div>
    </main>
  );
}
