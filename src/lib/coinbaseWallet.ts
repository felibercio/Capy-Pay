import CoinbaseWalletSDK from "@coinbase/wallet-sdk";

const APP_NAME = "Capy Pay";
const APP_LOGO_URL = typeof window !== "undefined" ? `${window.location.origin}/capy1.png` : undefined;
// Choose RPC and corresponding chainId (Base mainnet or Base Sepolia)
const FALLBACK_RPC_URL =
  (process.env.NEXT_PUBLIC_BASE_TESTNET_RPC_URL as string | undefined) ||
  (process.env.NEXT_PUBLIC_BASE_RPC_URL as string | undefined) ||
  "https://sepolia.base.org";
const FALLBACK_CHAIN_ID = FALLBACK_RPC_URL.includes("sepolia") ? 84532 : 8453;

let sdk: CoinbaseWalletSDK | null = null;

export function getCoinbaseSDK() {
  if (!sdk) {
    sdk = new CoinbaseWalletSDK({
      appName: APP_NAME,
      appLogoUrl: APP_LOGO_URL,
    });
  }
  return sdk;
}

/**
 * Returns a Web3-compatible provider from Coinbase Wallet SDK.
 * Falls back to window.ethereum coinbase provider when available.
 */
export function getCoinbaseProvider(): any | null {
  try {
    const anyWin = window as any;
    // Prefer native coinbase provider if present
    if (anyWin?.ethereum) {
      const providers = Array.isArray(anyWin.ethereum?.providers) ? anyWin.ethereum.providers : [anyWin.ethereum];
      const coinbase = providers?.find((p: any) => p?.isCoinbaseWallet);
      if (coinbase) return coinbase;
    }
    // SDK provider
    const wallet = getCoinbaseSDK();
    const provider = wallet.makeWeb3Provider(FALLBACK_RPC_URL, FALLBACK_CHAIN_ID);
    return provider as any;
  } catch {
    return null;
  }
}

export async function connectCoinbaseWallet(): Promise<string | null> {
  const provider = getCoinbaseProvider();
  if (!provider) throw new Error("Coinbase Wallet provider indisponível");
  const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
  const address = accounts?.[0] || null;
  return address;
}