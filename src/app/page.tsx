'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { supabase, getSupabaseSession } from '../lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  const isWalletConnected = () => {
    const cookieFlag = typeof document !== 'undefined' ? document.cookie.includes('wallet_connected=true') : false;
    const lsAddr = typeof window !== 'undefined' ? localStorage.getItem('walletAddress') : null;
    return cookieFlag || !!lsAddr;
  };

  useEffect(() => {
    try {
      const addr = localStorage.getItem('walletAddress');
      const type = localStorage.getItem('walletType');
      if (addr) setWalletAddress(addr);
      if (type) setWalletType(type);
    } catch {}
    // Hidratar sessão do Supabase para compatibilizar com middleware/token
    (async () => {
      const session = await getSupabaseSession();
      const accessToken = session?.access_token;
      if (accessToken) {
        try {
          localStorage.setItem('accessToken', accessToken);
          document.cookie = `capypay_access_token=${accessToken}; path=/`;
        } catch {}
      }
    })();
  }, []);

  const saveWalletLocally = (address: string, type: string) => {
    try {
      localStorage.setItem('walletAddress', address);
      localStorage.setItem('walletType', type);
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const resp = await fetch(`${API_BASE}/api/wallets/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ walletAddress: address, walletType: type }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.success) {
        throw new Error(json.error || 'Falha ao registrar conexão da carteira');
      }
    } catch (e: any) {
      console.warn('Falha ao salvar conexão no backend:', e?.message || e);
    }
  };

  const connectMetamask = async () => {
    setWalletError(null);
    try {
      const anyWindow = window as any;
      const provider = anyWindow.ethereum;
      if (!provider) {
        throw new Error('MetaMask não detectada');
      }
      const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
      const address = accounts?.[0];
      if (!address) throw new Error('Nenhuma conta retornada');
      saveWalletLocally(address, 'metamask');
      await postWalletConnection(address, 'metamask');
      router.push('/dashboard');
    } catch (e: any) {
      setWalletError(e?.message || 'Falha ao conectar MetaMask');
    }
  };

  const connectCoinbase = async () => {
    setWalletError(null);
    try {
      const anyWindow = window as any;
      let provider = anyWindow.ethereum;
      // Seleciona provider coinbase se múltiplos
      if (provider && provider.providers && Array.isArray(provider.providers)) {
        provider = provider.providers.find((p: any) => p.isCoinbaseWallet) || provider;
      }
      if (!provider || !provider.isCoinbaseWallet) {
        throw new Error('Coinbase Wallet não detectada');
      }
      const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
      const address = accounts?.[0];
      if (!address) throw new Error('Nenhuma conta retornada');
      saveWalletLocally(address, 'coinbase');
      await postWalletConnection(address, 'coinbase');
      router.push('/dashboard');
    } catch (e: any) {
      setWalletError(e?.message || 'Falha ao conectar Coinbase Wallet');
    }
  };

  const connectWalletConnect = async () => {
    setWalletError(null);
    try {
      const EthereumProvider = (await import('@walletconnect/ethereum-provider')).default;
      const provider = await EthereumProvider.init({
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
        chains: [8453], // Base mainnet
        optionalChains: [1],
        showQrModal: true,
      });
      await provider.enable();
      const accounts: string[] = provider.accounts || [];
      const address = accounts?.[0];
      if (!address) throw new Error('Nenhuma conta retornada');
      saveWalletLocally(address, 'walletconnect');
      await postWalletConnection(address, 'walletconnect');
      router.push('/dashboard');
    } catch (e: any) {
      setWalletError(e?.message || 'Falha ao conectar via WalletConnect');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const isSupabaseConfigured = !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    try {
      if (isSupabaseConfigured) {
        // Login real via Supabase (email/senha)
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        const accessToken = data?.session?.access_token;
        if (!accessToken) throw new Error('Sessão não criada. Verifique seu email.');

        try {
          localStorage.setItem('accessToken', accessToken);
          document.cookie = `capypay_access_token=${accessToken}; path=/`;
        } catch {}

        // Finalizar login no backend: criar carteira vinculada ao email
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const resp = await fetch(`${API_BASE}/api/auth/email-login/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const json = await resp.json();
        if (!resp.ok || !json.success) {
          throw new Error(json.error || 'Falha ao finalizar login no backend');
        }

        router.push('/dashboard');
        return;
      }

      // Fallback de demo quando Supabase não está configurado
      if (email === 'teste@capypay.com' && password === '123456') {
        console.log('✅ Login simulado bem-sucedido');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      } else {
        setError('Email ou senha incorretos. Use: teste@capypay.com / 123456');
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      // Iniciar OAuth com Supabase -> redireciona para Google e volta para /dashboard
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setError('Falha ao fazer login com o Google (Supabase).');
      setIsLoading(false);
    }
  };

  // Disponibilidade do Supabase (frontend)
  const isSupabaseConfigured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

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
          {/* Ações adicionais: cadastro e reset de senha */}
          <div className="flex items-center justify-between text-sm mt-2">
            <button
              type="button"
              className="text-capy-brown underline"
              onClick={() => router.push('/cadastre-se')}
              disabled={isLoading}
            >
              Cadastre-se
            </button>
            <button
              type="button"
              className="text-capy-brown underline"
              onClick={() => router.push('/esqueci-senha')}
              disabled={isLoading}
            >
              Esqueci a senha
            </button>
          </div>
        </form>

        <div className="my-4">
          <hr className="my-4" />
          <p className="text-sm text-gray-500">ou entre com</p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading || !isSupabaseConfigured}
          className={`w-full py-3 rounded-lg border flex justify-center items-center gap-2 ${
            isSupabaseConfigured ? 'border-gray-300 hover:bg-gray-100' : 'border-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          title={isSupabaseConfigured ? undefined : 'Supabase não configurado neste ambiente'}
        >
          <Image src="/google-icon.svg" alt="Google" width={20} height={20} />
          <span>Entrar com Google</span>
        </button>
        {!isSupabaseConfigured && (
          <p className="text-xs text-gray-500 mt-2">Login com Google indisponível: configure NEXT_PUBLIC_SUPABASE_URL/ANON_KEY.</p>
        )}

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

        {/* Seção de conexão de carteira na Home */}
        <div className="mt-8 text-left">
          <h3 className="text-lg font-semibold text-capy-dark mb-3">Conectar Carteira Web3</h3>
          <p className="text-sm text-capy-dark/70 mb-4">Para avançar, conecte sua MetaMask.</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={connectMetamask}
              className="w-full py-3 rounded-lg border border-capy-teal/30 hover:border-capy-brown flex justify-center items-center gap-2"
              disabled={isLoading}
            >
              <span>Conectar MetaMask</span>
            </button>
          </div>
          {walletAddress && (
            <p className="text-xs text-capy-dark/60 mt-3">Carteira conectada: {walletAddress} ({walletType})</p>
          )}
          {walletError && (
            <p className="text-red-500 text-xs mt-2">{walletError}</p>
          )}
        </div>

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
