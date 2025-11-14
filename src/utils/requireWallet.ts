"use client";

import { useRouter } from "next/navigation";

// Simple helper: on actions that need a wallet, route to connect page.
// Later we can enhance to check actual connection state via OnchainKit hooks.
export function useRequireWallet() {
  const router = useRouter();

  const ensureConnected = () => {
    router.push("/");
  };

  return { ensureConnected };
}