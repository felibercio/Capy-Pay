"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "../../lib/supabaseClient";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSupabaseConfigured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    if (!isSupabaseConfigured) {
      setMessage("Se existir uma conta para este email, enviaremos instruções.");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/redefinir-senha` : undefined,
      });
      if (error) throw error;
      setMessage("Email enviado. Verifique sua caixa de entrada.");
    } catch (err: any) {
      setError(err?.message || "Falha ao solicitar reset de senha");
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
        <h1 className="text-2xl font-bold text-capy-dark-brown mb-2">Esqueci a senha</h1>
        <p className="text-capy-green mb-6">Informe seu email para receber o link de redefinição.</p>

        <form onSubmit={handleReset} className="space-y-4 text-left">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            {isLoading ? "Enviando..." : "Enviar instruções"}
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