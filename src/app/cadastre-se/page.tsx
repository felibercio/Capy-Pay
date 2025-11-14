"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "../../lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSupabaseConfigured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      setIsLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      // Fallback simples para demo
      setMessage("Cadastro simulado: verifique seu email para confirmar.");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined,
        },
      });

      if (error) throw error;

      if (data?.session?.access_token) {
        try {
          localStorage.setItem("accessToken", data.session.access_token);
          document.cookie = `capypay_access_token=${data.session.access_token}; path=/`;
        } catch {}
        router.push("/dashboard");
        return;
      }

      setMessage(
        "Cadastro criado. Verifique seu email para confirmar e depois faça login."
      );
    } catch (err: any) {
      setError(err?.message || "Falha ao cadastrar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-capy-light-green p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center border border-capy-green">
        <div className="flex justify-center mb-6">
          <Image src="/capy1.png" alt="Capy Pay Logo" width={120} height={120} priority className="rounded-full" />
        </div>
        <h1 className="text-2xl font-bold text-capy-dark-brown mb-2">Criar conta</h1>
        <p className="text-capy-green mb-6">Cadastre-se para começar a usar o Capy Pay.</p>

        <form onSubmit={handleSignup} className="space-y-4 text-left">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg text-gray-700"
            required
            disabled={isLoading}
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg text-gray-700"
            required
            disabled={isLoading}
          />
          <input
            type="password"
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg text-gray-700"
            required
            disabled={isLoading}
          />

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-lg text-lg font-semibold ${
              isLoading ? "bg-gray-400" : "bg-capy-teal text-white hover:bg-capy-dark-teal"
            }`}
          >
            {isLoading ? "Cadastrando..." : "Cadastre-se"}
          </button>
        </form>

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        {message && <p className="text-green-600 text-sm mt-4">{message}</p>}

        <button
          type="button"
          className="mt-6 text-sm text-capy-brown underline"
          onClick={() => router.push("/")}
        >
          Voltar para o login
        </button>
      </div>
    </div>
  );
}