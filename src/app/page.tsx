// src/app/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { FiLoader, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { useWeb3Auth } from '@/context/Web3AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoggedIn, isLoading, isInitialized, error: contextError } = useWeb3Auth();
  const [localError, setLocalError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Redirecionar se já estiver logado
  useEffect(() => {
    if (isLoggedIn && isInitialized) {
      console.log("✅ Usuário já está logado, redirecionando...");
      router.push('/dashboard');
    }
  }, [isLoggedIn, isInitialized, router]);

  const handleLogin = async () => {
    if (!isInitialized) {
      setLocalError("Web3Auth ainda não foi inicializado. Aguarde...");
      return;
    }
    
    setLocalError(null);
    
    try {
      console.log("🚀 Iniciando login com Web3Auth via contexto...");
      
      await login();
      
      setLoginSuccess(true);
      console.log("✅ Login realizado com sucesso!");
      
      // Redirecionar após delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
      
    } catch (err: any) {
      console.error("❌ Erro no login:", err);
      setLocalError(err.message || "Falha no login. Tente novamente.");
      setLoginSuccess(false);
    }
  };

  const currentError = localError || contextError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-capy-light-green p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center border border-capy-green">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/images/capy-logo.svg"
            alt="Capy Pay Logo"
            width={120}
            height={120}
            priority={true}
            className="rounded-full"
          />
        </div>
        
        <h1 className="text-3xl font-bold text-capy-dark-brown mb-2">Capy Pay</h1>
        <p className="text-capy-green mb-8">Câmbio e pagamentos globais na Base, simples e seguros.</p>

        {/* Status da inicialização */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
          <div className="text-gray-600">
            <strong>Status da inicialização:</strong>
          </div>
          <div className={`${isInitialized ? 'text-green-600' : 'text-orange-500'}`}>
            Web3Auth: {isInitialized ? '✅ Inicializado' : '⏳ Inicializando...'}
          </div>
          <div className="text-gray-600">
            Client ID: {process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID ? '✅ Configurado' : '❌ Faltando'}
          </div>
          {isLoggedIn && (
            <div className="text-blue-600">
              Status: ✅ Conectado
            </div>
          )}
        </div>

        {/* Botão de Login */}
        <button
          onClick={handleLogin}
          disabled={isLoading || loginSuccess || !isInitialized}
          className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg text-lg font-semibold transition-all duration-300
            ${isLoading || loginSuccess || !isInitialized
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-capy-teal text-white hover:bg-capy-dark-teal'}
          `}
        >
          {isLoading && <FiLoader className="animate-spin" />}
          {loginSuccess && <FiCheckCircle />}
          {!isLoading && !loginSuccess && (
            <img
              src="https://developers.google.com/identity/images/g-logo.png"
              alt="Google logo"
              className="w-6 h-6"
            />
          )}
          <span>
            {!isInitialized 
              ? 'Inicializando...' 
              : isLoading 
                ? 'Conectando...' 
                : loginSuccess 
                  ? 'Conectado!' 
                  : 'Entrar com Google'
            }
          </span>
        </button>

        {/* Mensagem de Erro */}
        {currentError && (
          <p className="text-red-500 text-sm mt-4 flex items-center justify-center">
            <FiXCircle className="mr-2" /> {currentError}
          </p>
        )}

        {/* Informações sobre a integração */}
        <div className="mt-6 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
          <strong>🔧 Web3Auth Context (Fase 2):</strong>
          <br />
          Login real com Web3Auth via React Context.
          <br />
          Autenticação Google + Carteira EVM na Base Sepolia.
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade.
        </p>
      </div>
    </div>
  );
} 