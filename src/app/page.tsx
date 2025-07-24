'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { signInWithPopup } from 'firebase/auth';
import { auth, provider } from '../firebaseconfig'; // Ajuste o caminho conforme necessário

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (email === 'teste@capypay.com' && password === '123456') {
      console.log('✅ Login simulado bem-sucedido');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } else {
      setError('Email ou senha incorretos. Use: teste@capypay.com / 123456');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      await signInWithPopup(auth, provider);
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      setError('Falha ao fazer login com o Google.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-capy-light-green p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center border border-capy-green">
        <div className="flex justify-center mb-6">
          <Image src="/capy1.png" alt="Capy Pay Logo" width={120} height={120} priority className="rounded-full" />
        </div>

        <h1 className="text-3xl font-bold text-capy-dark-brown mb-2">Capy Pay</h1>
        <p className="text-capy-green mb-8">Câmbio e pagamentos globais na Base, simples e seguros.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg text-gray-700"
            required
            disabled={isLoading}
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg text-gray-700 pr-12"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              disabled={isLoading}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-lg text-lg font-semibold ${
              isLoading ? 'bg-gray-400' : 'bg-capy-teal text-white hover:bg-capy-dark-teal'
            }`}
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="my-4">
          <hr className="my-4" />
          <p className="text-sm text-gray-500">ou entre com</p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full py-3 rounded-lg border border-gray-300 hover:bg-gray-100 flex justify-center items-center gap-2"
        >
          <Image src="/google-icon.svg" alt="Google" width={20} height={20} />
          <span>Entrar com Google</span>
        </button>

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

        <div className="mt-6 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
          <strong>🧪 Credenciais de Teste:</strong><br />
          Email: teste@capypay.com<br />
          Senha: 123456
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade.
        </p>
      </div>
    </div>
  );
}
