"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  FiArrowLeft,
  FiDollarSign,
  FiCheck,
  FiCopy,
  FiGrid,
  FiCheckCircle,
  FiCreditCard,
  FiInfo,
} from "react-icons/fi";

export default function PixPage() {
  const [pixValue, setPixValue] = useState("");
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [pixKey, setPixKey] = useState<string | null>(null);
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [onchainTxHash, setOnchainTxHash] = useState<string | null>(null);
  const [capyMintInfo, setCapyMintInfo] = useState<{ txHash: string; amount: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [pixTransactionId, setPixTransactionId] = useState<string | null>(null);

  // Hidratar token e obter perfil para userId; pegar endereço não-custodial local
  useEffect(() => {
    const token = (() => {
      try {
        return (
          localStorage.getItem("accessToken") ||
          localStorage.getItem("token") ||
          localStorage.getItem("jwt") ||
          null
        );
      } catch {
        return null;
      }
    })();

    const localAddr = (() => {
      try {
        return localStorage.getItem("walletAddress");
      } catch {
        return null;
      }
    })();
    setWalletAddress(localAddr);

    // Fallback: sem token mas com carteira conectada -> definir demoUserId baseado na carteira
    if (!token && localAddr) {
      const fallbackUserId = `wallet_${localAddr}`;
      try {
        localStorage.setItem("demoUserId", fallbackUserId);
      } catch {}
      setUserId(fallbackUserId);
    }

    // Tentar obter userId via perfil autenticado
    const loadProfile = async () => {
      if (!token) return;
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const res = await fetch(`${API_BASE}/api/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setUserId(json.data?.id || json.data?.user?.id || null);
        }
      } catch {}
    };
    loadProfile();

    // Se autenticado pelo Google (token presente) e não houver endereço local,
    // buscar o endereço da carteira custodial no backend e persistir.
    const loadWalletAddress = async () => {
      if (!token || localAddr) return;
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const res = await fetch(`${API_BASE}/api/auth/wallet/address`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (res.ok && json.success && json.data?.address) {
          const addr = json.data.address as string;
          setWalletAddress(addr);
          try { localStorage.setItem('walletAddress', addr); } catch {}
        } else {
          const fallback = process.env.NEXT_PUBLIC_BASE_WALLET_ADDRESS || null;
          if (fallback) {
            setWalletAddress(fallback);
            try { localStorage.setItem('walletAddress', fallback); } catch {}
          }
        }
      } catch {}
    };
    loadWalletAddress();
  }, []);

  const generateQRCode = async () => {
    setError(null);
    const parsed = parseFloat((pixValue || '').replace(',', '.'));
    if (!pixValue || isNaN(parsed) || parsed <= 0) {
      alert("Por favor, insira um valor válido");
      return;
    }

    // Garantir userId: se não autenticado, usar fallback baseado na carteira conectada
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const demoUser = (() => {
        try {
          return localStorage.getItem("demoUserId");
        } catch {
          return null;
        }
      })();
      if (demoUser) {
        effectiveUserId = demoUser;
        setUserId(demoUser);
      } else if (walletAddress) {
        const fallback = `wallet_${walletAddress}`;
        try {
          localStorage.setItem("demoUserId", fallback);
        } catch {}
        setUserId(fallback);
        effectiveUserId = fallback;
      } else {
        setError(
          "É necessário estar autenticado para gerar QR PIX. Faça login para obter o userId ou conecte sua carteira."
        );
        return;
      }
    }

    try {
      setIsGenerating(true);
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const res = await fetch(`${API_BASE}/api/payments/pix/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parsed,
          description: "Pagamento via Capy Pay",
          userId: effectiveUserId,
          userAddress: walletAddress || undefined,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const payload: any = isJson ? await res.json() : await res.text();
      if (!isJson) {
        throw new Error(typeof payload === 'string' && payload ? payload : `Erro ${res.status} ao gerar QR Code PIX`);
      }
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Falha ao gerar QR Code PIX");
      }

      const data = payload.data || {};
      setQrCodeData(data.qrCode || null);
      setQrCodeImage(data.qrCodeImage || null);
      setPixKey(data.pixKey || null);
      setPixTransactionId(data.id || data.externalId || null);
      setPaymentReceived(false);
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('internal server') || msg.includes('socket hang up') || msg.includes('fetch failed')) {
        setError('Falha ao comunicar com o backend (porta 3001). Verifique se o servidor está ativo.');
      } else {
        setError(err.message || "Erro inesperado ao gerar QR Code PIX");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const simulatePaymentReceived = async () => {
    setError(null);
    try {
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const demoUser = (() => {
          try {
            return localStorage.getItem("demoUserId");
          } catch {
            return null;
          }
        })();
        if (demoUser) {
          effectiveUserId = demoUser;
          setUserId(demoUser);
        } else if (walletAddress) {
          const fallback = `wallet_${walletAddress}`;
          try {
            localStorage.setItem("demoUserId", fallback);
          } catch {}
          setUserId(fallback);
          effectiveUserId = fallback;
        } else {
          throw new Error(
            "Não foi possível identificar o usuário. Faça login ou conecte sua carteira para simular o crédito."
          );
        }
      }
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const res = await fetch(`${API_BASE}/api/payments/pix/simulate-credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: effectiveUserId,
          amount: parseFloat((pixValue || '').replace(',', '.')),
          description: "PIX credit simulation",
          userAddress: walletAddress || undefined,
          transactionId: pixTransactionId || undefined,
        }),
      });
      const contentType2 = res.headers.get('content-type') || '';
      const isJson2 = contentType2.includes('application/json');
      const payload2: any = isJson2 ? await res.json() : await res.text();
      if (!isJson2) {
        throw new Error(typeof payload2 === 'string' && payload2 ? payload2 : `Erro ${res.status} ao simular crédito PIX`);
      }
      if (!res.ok || !payload2.success) {
        throw new Error(payload2.error || "Falha ao simular crédito PIX");
      }

      // Guardar hashes on-chain do registro e do mint (se houver)
      const regHash: string | null = payload2.onchainRegistry?.txHash || null;
      const mintHash: string | null = payload2.capyMint?.txHash || null;
      const mintAmount: number | null = payload2.capyMint?.capyAmount ?? null;
      setOnchainTxHash(regHash);
      if (mintHash && mintAmount) {
        setCapyMintInfo({ txHash: mintHash, amount: mintAmount });
      } else {
        setCapyMintInfo(null);
      }

      setPaymentReceived(true);
      // Auto-limpar após 5 segundos
      setTimeout(() => {
        setQrCodeData(null);
        setQrCodeImage(null);
        setPixKey(null);
        setPixTransactionId(null);
        setPaymentReceived(false);
        setOnchainTxHash(null);
        setCapyMintInfo(null);
        setPixValue("");
      }, 5000);
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('internal server') || msg.includes('socket hang up') || msg.includes('fetch failed')) {
        setError('Falha ao comunicar com o backend (porta 3001). Verifique se o servidor está ativo.');
      } else {
        setError(err.message || "Erro inesperado na simulação de crédito PIX");
      }
    }
  };

  const copyPixKey = async () => {
    if (pixKey) {
      try {
        await navigator.clipboard.writeText(pixKey);
      } catch (err) {}
    }
  };

  const copyQRCode = async () => {
    if (qrCodeData) {
      try {
        await navigator.clipboard.writeText(qrCodeData);
      } catch (err) {}
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

      {/* Main Content */}
      <div className="space-y-6">
        {/* Payment Value Input */}
        <div className="capy-card">
          <div className="flex items-center mb-4">
            <FiDollarSign className="w-5 h-5 text-capy-brown mr-2" />
            <h3 className="text-lg font-semibold text-capy-dark">Receber PIX</h3>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-3 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-capy-dark mb-2">
                Valor do PIX (BRL)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={pixValue}
                  onChange={(e) => setPixValue(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-capy-teal focus:border-transparent outline-none text-gray-700"
                  disabled={isGenerating || !!qrCodeData}
                />
              </div>
            </div>

            <button
              onClick={generateQRCode}
              disabled={isGenerating || !!qrCodeData || isNaN(parseFloat((pixValue || '').replace(',', '.'))) || parseFloat((pixValue || '').replace(',', '.')) <= 0}
              className={`w-full py-3 rounded-lg text-lg font-semibold transition-all duration-300 ${
                isGenerating
                  ? "bg-gray-400 cursor-not-allowed text-gray-600"
                  : qrCodeData
                  ? "bg-green-500 text-white cursor-not-allowed"
                  : !isNaN(parseFloat((pixValue || '').replace(',', '.'))) && parseFloat((pixValue || '').replace(',', '.')) > 0
                  ? "bg-capy-teal text-white hover:bg-capy-dark-teal"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
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
                  PIX de R$ {parseFloat((pixValue || '').replace(',', '.')).toFixed(2)} foi recebido com sucesso.
                </p>
                {onchainTxHash && (
                  <p className="text-sm text-green-700 mt-2 break-all">
                    Registro on-chain: {onchainTxHash}
                  </p>
                )}
                {capyMintInfo && (
                  <p className="text-sm text-green-700 mt-1 break-all">
                    Mint CAPY: {capyMintInfo.amount.toFixed(2)} CAPY — tx {capyMintInfo.txHash}
                  </p>
                )}
                <p className="text-sm text-green-600 mt-2">
                  Esta tela será limpa automaticamente...
                </p>
              </div>
            ) : (
              <>
                {/* QR Code */}
                <div className="bg-white p-6 rounded-lg border border-gray-200 mb-4 inline-block">
                  {qrCodeImage ? (
                    // Imagem base64 vinda do backend (se disponível)
                    <img
                      src={qrCodeImage}
                      alt="QR Code PIX"
                      className="w-[200px] h-[200px] object-contain"
                    />
                  ) : (
                    <QRCodeSVG value={qrCodeData} size={200} />
                  )}
                </div>

                {/* Payment Details */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor:</span>
                      <span className="font-medium text-capy-dark">
                        R$ {(() => { const v = parseFloat((pixValue || '').replace(',', '.')); return isNaN(v) ? '0.00' : v.toFixed(2); })()}
                      </span>
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
                      <span className="font-medium text-capy-dark">Capy Pay</span>
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

        {/* Charge Info */}
        {qrCodeData && (
          <div className="capy-card">
            <div className="flex items-center mb-4">
              <FiCreditCard className="w-5 h-5 text-capy-brown mr-2" />
              <h3 className="text-lg font-semibold text-capy-dark">Dados da Cobrança</h3>
            </div>

            <div className="bg-capy-light rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-capy-dark/70 text-sm">Chave PIX:</span>
                <span className="font-medium text-capy-dark text-sm">{pixKey || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-capy-dark/70 text-sm">ID Transação:</span>
                <span className="font-medium text-capy-dark text-sm">{pixTransactionId || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-capy-dark/70 text-sm">Seu endereço:</span>
                <span className="font-medium text-capy-dark text-sm">{walletAddress || "(não conectado)"}</span>
              </div>
            </div>
          </div>
        )}

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
