import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

// Cria o cliente Supabase (frontend) somente se configurado
export const supabase: any = (url && key)
  ? createClient(url, key)
  : {
      auth: {
        // Fallback seguro quando não configurado
        signInWithOAuth: async () => ({ data: null, error: new Error('Supabase not configured') }),
        getSession: async () => ({ data: { session: null } }),
        signOut: async () => ({ error: null }),
      },
    };

// Helper para obter sessão atual com segurança
export async function getSupabaseSession() {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  } catch {
    return null;
  }
}