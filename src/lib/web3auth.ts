// src/lib/web3auth.ts
// Configuração mínima do Web3Auth Modal para o Capy Pay

import { Web3Auth } from "@web3auth/modal";
import { WEB3AUTH_NETWORK } from "@web3auth/base";

// Criar instância do Web3Auth Modal (configuração mínima)
export const createWeb3Auth = (clientId: string): Web3Auth => {
  const web3auth = new Web3Auth({
    clientId,
    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
    uiConfig: {
      appName: "Capy Pay",
      mode: "light",
      logoLight: "https://web3auth.io/images/web3auth-logo.svg",
      logoDark: "https://web3auth.io/images/web3auth-logo---Dark.svg",
      defaultLanguage: "pt",
      loginMethodsOrder: ["google", "email_passwordless"],
      primaryButton: "socialLogin",
      theme: {
        primary: "#14b8a6"
      },
    },
  });

  return web3auth;
}; 