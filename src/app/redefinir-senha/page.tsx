"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "../../lib/supabaseClient";

function parseHash(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const hash = window.location.hash || "";
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const entries: Record<string, string> = {};
  params.forEach((v, k) => {
    entries[k] = v;
  });
  return entries;
}

export default function ResetPasswordConsumeTokenPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const isSupabaseConfigured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const urlInfo = useMemo(() => {
    const hashParams = parseHash();
    const type = (hashParams["type"] || searchParams.get("type") || "").toLowerCase();
    const access_token = hashParams["access_token"] || "";
    const refresh_token = hashParams["refresh_token"] || "";
    const code = searchParams.get("code") || ""; // caso venha por PKCE/magic link
    return { type, access_token, refresh_token, code };
  }, [searchParams]);

  useEffect(() => {
    async function establishSession() {
      if (!isSupabaseConfigured) return;
      try {
        // Preferência: recovery com access_token/refresh_token no hash
        if (urlInfo.type === "recovery" && urlInfo.access_token) {
          const { error } = await supabase.auth.setSession({
            access_token: urlInfo.access_token,
            refresh_token: urlInfo.refresh_token,
          });
          if (error) throw error;
          setSessionReady(true);
          setStatusMsg("Sessão de recuperação estabelecida. Defina sua nova senha.");
          return;
        }
        // Alternativa: se vier como código (edge cases)
        if (urlInfo.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(urlInfo.code);
          if (error) throw error;
          setSessionReady(true);
          setStatusMsg("Sessão estabelecida via código. Defina sua nova senha.");
          return;
        }
        // Sem token/código: instrução
        setStatusMsg(
          "Link inválido ou expirado. Solicite novamente em 'Esqueci a senha'."
        );
      } catch (err: any) {
        setError(err?.message || "Falha ao preparar sessão de recuperação");
      }
    }
    establishSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlInfo.type, urlInfo.access_token, urlInfo.refresh_token, urlInfo.code, isSupabaseConfigured]);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatusMsg(null);
    setIsLoading(true);

    if (!isSupabaseConfigured) {
      setError("Supabase não configurado. Configure as variáveis no env.");
      setIsLoading(false);
      return;
    }

    if (!sessionReady) {
      setError("Sessão de recuperação não está pronta. Abra o link do email novamente.");
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      setIsLoading(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setStatusMsg("Senha atualizada com sucesso! Redirecionando para o login...");
      setTimeout(() => router.push("/"), 1500);
    } catch (err: any) {
      setError(err?.message || "Falha ao atualizar senha");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-capy-light-green p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center border border-capy-green">
        <div className="flex justify-center mb-6">
          <Image src="/capy1.png" alt="Capy Pay Logo" width={120} height={120} priority className="rounded-full" />
        </div>

        <h1 className="text-2xl font-bold text-capy-dark-brown mb-2">Redefinir senha</h1>
        <p className="text-capy-green mb-6">Defina sua nova senha para concluir o processo.</p>

        <form onSubmit={handleUpdatePassword} className="space-y-4 text-left">
          <input
            type="password"
            placeholder="Nova senha"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg text-gray-700"
            required
            disabled={isLoading}
          />
          <input
            type="password"
            placeholder="Confirmar nova senha"
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
            {isLoading ? "Atualizando..." : "Atualizar senha"}
          </button>
        </form>

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        {statusMsg && <p className="text-green-600 text-sm mt-4">{statusMsg}</p>}

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