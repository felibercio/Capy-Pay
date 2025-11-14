"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BrowserProvider } from "ethers";
import { connectCoinbaseWallet, getCoinbaseProvider } from "../../lib/coinbaseWallet";
import { useRouter } from "next/navigation";

export default function ConnectWalletPage() {
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      const addr = localStorage.getItem("walletAddress");
      const type = localStorage.getItem("walletType");
      if (addr) setWalletAddress(addr);
      if (type) setWalletType(type);
    } catch {}
  }, []);

  const saveWalletLocally = (address: string, type: string) => {
    try {
      localStorage.setItem("walletAddress", address);
      localStorage.setItem("walletType", type);
    } catch {}
    try {
      document.cookie = `wallet_connected=true; path=/`;
      document.cookie = `wallet_address=${address}; path=/`;
      document.cookie = `wallet_type=${type}; path=/`;
    } catch {}
    setWalletAddress(address);
    setWalletType(type);
  };

  const postWalletConnection = async (address: string, type: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const resp = await fetch(`${API_BASE}/api/wallets/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ walletAddress: address, walletType: type }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.success) {
        throw new Error(json.error || "Falha ao registrar conexão da carteira");
      }
    } catch (e: any) {
      console.warn("Falha ao salvar conexão no backend:", e?.message || e);
    }
  };

  const connectMetamask = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const anyWin = window as any;
      if (!anyWin.ethereum) throw new Error("MetaMask não detectada");
      const provider = new BrowserProvider(anyWin.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      if (!address) throw new Error("Nenhuma conta retornada");
      saveWalletLocally(address, "metamask");
      await postWalletConnection(address, "metamask");
      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.message || "Falha ao conectar MetaMask");
    } finally {
      setIsLoading(false);
    }
  };

  const connectCoinbase = async () => {
    setError(null);
    setIsLoading(true);
    try {
      // Usa SDK quando a extensão/app não estiver disponível
      const address = await connectCoinbaseWallet();
      if (!address) throw new Error("Nenhuma conta retornada");
      saveWalletLocally(address, "coinbase");
      await postWalletConnection(address, "coinbase");
      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.message || "Falha ao conectar Coinbase Wallet");
    } finally {
      setIsLoading(false);
    }
  };

  const connectWalletConnect = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const EthereumProvider = (await import("@walletconnect/ethereum-provider")).default;
      const provider = await EthereumProvider.init({
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
        chains: [8453],
        optionalChains: [1],
        showQrModal: true,
      });
      await provider.enable();
      const accounts: string[] = provider.accounts || [];
      const address = accounts?.[0];
      if (!address) throw new Error("Nenhuma conta retornada");
      saveWalletLocally(address, "walletconnect");
      await postWalletConnection(address, "walletconnect");
      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.message || "Falha ao conectar via WalletConnect");
    } finally {
      setIsLoading(false);
    }
  };

  const goToDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-capy-light-green p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center border border-capy-green">
        <div className="flex justify-center mb-6">
          <Image src="/capy1.png" alt="Capy Pay Logo" width={120} height={120} priority className="rounded-full" />
        </div>
        <h1 className="text-3xl font-bold text-capy-dark-brown mb-2">Conectar Carteira</h1>
        <p className="text-capy-green mb-6">Selecione sua carteira preferida para vincular ao Capy Pay.</p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={connectMetamask}
            className="w-full py-3 rounded-lg border border-capy-teal/30 hover:border-capy-brown"
            disabled={isLoading}
          >
            Conectar MetaMask
          </button>
          <button
            type="button"
            onClick={connectWalletConnect}
            className="w-full py-3 rounded-lg border border-capy-teal/30 hover:border-capy-brown"
            disabled={isLoading}
          >
            Conectar via WalletConnect
          </button>
          <button
            type="button"
            onClick={connectCoinbase}
            className="w-full py-3 rounded-lg border border-capy-teal/30 hover:border-capy-brown"
            disabled={isLoading}
          >
            Conectar Coinbase Wallet
          </button>
        </div>

        {walletAddress && (
          <p className="text-xs text-capy-dark/60 mt-3">Carteira conectada: {walletAddress} ({walletType})</p>
        )}
        {error && (
          <p className="text-red-500 text-xs mt-2">{error}</p>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={goToDashboard}
            className="w-full py-3 rounded-lg text-lg font-semibold bg-capy-teal text-white hover:bg-capy-dark-teal"
            disabled={isLoading}
          >
            Ir para Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}