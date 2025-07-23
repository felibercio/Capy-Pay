// src/lib/walletService.ts
// Serviço para abstração das interações com a carteira

import { ethers } from 'ethers';
import { IProvider } from '@web3auth/base';

export interface WalletInfo {
  address: string;
  balance: string;
  chainId: number;
}

export class WalletService {
  private provider: IProvider | null = null;
  private ethersProvider: ethers.BrowserProvider | null = null;

  // Conectar o provedor Web3Auth
  async connect(provider: IProvider): Promise<void> {
    this.provider = provider;
    this.ethersProvider = new ethers.BrowserProvider(provider);
    console.log('WalletService: ✅ Provedor conectado com sucesso');
  }

  // Desconectar
  disconnect(): void {
    this.provider = null;
    this.ethersProvider = null;
    console.log('WalletService: 👋 Desconectado');
  }

  // Verificar se está conectado
  isConnected(): boolean {
    return this.provider !== null && this.ethersProvider !== null;
  }

  // Obter informações da carteira
  async getWalletInfo(): Promise<WalletInfo> {
    if (!this.ethersProvider) {
      throw new Error('Carteira não conectada');
    }

    const signer = await this.ethersProvider.getSigner();
    const address = await signer.getAddress();
    const balance = await this.ethersProvider.getBalance(address);
    const network = await this.ethersProvider.getNetwork();

    console.log('WalletService: 💰 Informações da carteira obtidas:', {
      address,
      balance: ethers.formatEther(balance),
      chainId: Number(network.chainId)
    });

    return {
      address,
      balance: ethers.formatEther(balance),
      chainId: Number(network.chainId),
    };
  }

  // Assinar mensagem
  async signMessage(message: string): Promise<string> {
    if (!this.ethersProvider) {
      throw new Error('Carteira não conectada');
    }

    const signer = await this.ethersProvider.getSigner();
    const signature = await signer.signMessage(message);
    
    console.log('WalletService: ✍️ Mensagem assinada:', {
      message,
      signature
    });

    return signature;
  }

  // Obter endereço da conta
  async getAddress(): Promise<string> {
    if (!this.ethersProvider) {
      throw new Error('Carteira não conectada');
    }

    const signer = await this.ethersProvider.getSigner();
    return await signer.getAddress();
  }

  // Obter saldo
  async getBalance(): Promise<string> {
    if (!this.ethersProvider) {
      throw new Error('Carteira não conectada');
    }

    const signer = await this.ethersProvider.getSigner();
    const address = await signer.getAddress();
    const balance = await this.ethersProvider.getBalance(address);
    
    return ethers.formatEther(balance);
  }
}

// Instância singleton do serviço
export const walletService = new WalletService(); 