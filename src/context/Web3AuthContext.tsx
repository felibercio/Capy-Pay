// src/context/Web3AuthContext.tsx
// Contexto React para gerenciamento do Web3Auth

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Web3Auth } from '@web3auth/modal';
import { IProvider } from '@web3auth/base';
import { createWeb3Auth } from '@/lib/web3auth';
import { walletService, WalletInfo } from '@/lib/walletService';

// Interface do contexto
export interface Web3AuthContextType {
  web3auth: Web3Auth | null;
  provider: IProvider | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  walletInfo: WalletInfo | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getUserInfo: () => Promise<any>;
  signMessage: (message: string) => Promise<string>;
}

// Criar o contexto
const Web3AuthContext = createContext<Web3AuthContextType | null>(null);

// Hook para usar o contexto
export const useWeb3Auth = (): Web3AuthContextType => {
  const context = useContext(Web3AuthContext);
  if (!context) {
    throw new Error('useWeb3Auth deve ser usado dentro de um Web3AuthContextProvider');
  }
  return context;
};

// Props do provider
interface Web3AuthContextProviderProps {
  children: ReactNode;
}

// Provider do contexto
export const Web3AuthContextProvider: React.FC<Web3AuthContextProviderProps> = ({ children }) => {
  const [web3auth, setWeb3auth] = useState<Web3Auth | null>(null);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);

  // Inicialização do Web3Auth
  useEffect(() => {
    const init = async () => {
      try {
        console.log("Web3AuthContext: 🚀 Iniciando inicialização...");
        setIsLoading(true);
        setError(null);

        // Verificar Client ID
        const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
        if (!clientId) {
          throw new Error("NEXT_PUBLIC_WEB3AUTH_CLIENT_ID não está configurado no arquivo .env.local");
        }

        console.log("Web3AuthContext: ✅ Client ID encontrado:", clientId.substring(0, 10) + "...");

        // Criar instância Web3Auth (o Modal gerencia os adapters automaticamente)
        const web3AuthInstance = createWeb3Auth(clientId);

        console.log("Web3AuthContext: 🔄 Inicializando Web3Auth...");
        await web3AuthInstance.init();

        console.log("Web3AuthContext: ✅ Web3Auth inicializado com sucesso!");
        console.log("Web3AuthContext: 🔍 Status da conexão:", web3AuthInstance.connected);

        setWeb3auth(web3AuthInstance);
        setIsInitialized(true);

        // Verificar se já existe uma sessão ativa
        if (web3AuthInstance.connected) {
          console.log("Web3AuthContext: 🎉 Sessão ativa encontrada!");
          setProvider(web3AuthInstance.provider);
          setIsLoggedIn(true);
          await loadWalletInfo(web3AuthInstance.provider!);
        } else {
          console.log("Web3AuthContext: ⚠️ Nenhuma sessão ativa encontrada");
        }

      } catch (err: any) {
        console.error("Web3AuthContext: ❌ ERRO na inicialização:", err);
        setError(`Erro ao inicializar Web3Auth: ${err.message}`);
      } finally {
        setIsLoading(false);
        console.log("Web3AuthContext: 🏁 Inicialização finalizada");
      }
    };

    // Pequeno delay para garantir que o DOM está pronto
    setTimeout(() => {
      init();
    }, 500);
  }, []);

  // Carregar informações da carteira
  const loadWalletInfo = async (provider: IProvider) => {
    try {
      console.log("Web3AuthContext: 🔄 Carregando informações da carteira...");
      await walletService.connect(provider);
      const info = await walletService.getWalletInfo();
      setWalletInfo(info);
      console.log("Web3AuthContext: ✅ Informações da carteira carregadas:", info);
    } catch (err) {
      console.error("Web3AuthContext: ❌ Erro ao carregar informações da carteira:", err);
    }
  };

  // Função de login
  const login = async (): Promise<void> => {
    console.log("Web3AuthContext: 🔑 Tentativa de login iniciada...");
    if (!web3auth) {
      throw new Error("Web3Auth não inicializado");
    }
    if (!isInitialized) {
      throw new Error("Web3Auth ainda não foi inicializado completamente");
    }
    
    try {
      setIsLoading(true);
      setError(null);

      console.log("Web3AuthContext: 🚀 Chamando connect...");
      const web3authProvider = await web3auth.connect();

      if (web3authProvider) {
        console.log("Web3AuthContext: ✅ Provider obtido com sucesso!");
        setProvider(web3authProvider);
        setIsLoggedIn(true);
        await loadWalletInfo(web3authProvider);
        console.log("Web3AuthContext: 🎉 Login completado com sucesso!");
      } else {
        throw new Error("Falha na conexão: Provider não foi retornado pelo Web3Auth");
      }

    } catch (err: any) {
      console.error("Web3AuthContext: ❌ ERRO no login:", err);
      if (err.message?.includes("User closed the modal") || err.code === 4001) {
        setError("Login cancelado pelo usuário");
      } else {
        setError(`Erro no login: ${err.message}`);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Função de logout
  const logout = async (): Promise<void> => {
    if (!web3auth) {
      throw new Error("Web3Auth não inicializado");
    }
    
    try {
      console.log("Web3AuthContext: 👋 Fazendo logout...");
      setIsLoading(true);
      await web3auth.logout();
      walletService.disconnect();
      setProvider(null);
      setIsLoggedIn(false);
      setWalletInfo(null);
      console.log("Web3AuthContext: ✅ Logout realizado com sucesso");
    } catch (err: any) {
      console.error("Web3AuthContext: ❌ Erro no logout:", err);
      setProvider(null);
      setIsLoggedIn(false);
      setWalletInfo(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Obter informações do usuário
  const getUserInfo = async (): Promise<any> => {
    if (!web3auth) {
      throw new Error("Web3Auth não inicializado");
    }
    
    try {
      const userInfo = await web3auth.getUserInfo();
      console.log("Web3AuthContext: 👤 Informações do usuário obtidas:", userInfo);
      return userInfo;
    } catch (err: any) {
      console.error("Web3AuthContext: ❌ Erro ao obter informações do usuário:", err);
      throw err;
    }
  };

  // Assinar mensagem
  const signMessage = async (message: string): Promise<string> => {
    if (!provider || !isLoggedIn) {
      throw new Error("Web3Auth não conectado");
    }
    
    try {
      console.log("Web3AuthContext: ✍️ Assinando mensagem:", message);
      const signature = await walletService.signMessage(message);
      console.log("Web3AuthContext: ✅ Mensagem assinada com sucesso");
      return signature;
    } catch (err: any) {
      console.error("Web3AuthContext: ❌ Erro ao assinar mensagem:", err);
      throw err;
    }
  };

  // Valor do contexto
  const contextValue: Web3AuthContextType = {
    web3auth,
    provider,
    isLoggedIn,
    isLoading,
    isInitialized,
    error,
    walletInfo,
    login,
    logout,
    getUserInfo,
    signMessage,
  };

  return (
    <Web3AuthContext.Provider value={contextValue}>
      {children}
    </Web3AuthContext.Provider>
  );
}; 