'use client';

import { useState, useEffect } from 'react';
import { MiniKitState } from '@/types';
import { MINIKIT_CONFIG } from '@/constants';

// Simulação da integração com MiniKit
// Em produção, isso seria substituído pela integração real com @worldcoin/minikit-js
export function useMiniKit(): MiniKitState & {
  connect: () => Promise<void>;
  disconnect: () => void;
} {
  const [state, setState] = useState<MiniKitState>({
    isInitialized: false,
    isConnected: false,
    user: null,
  });

  useEffect(() => {
    // Simular inicialização do MiniKit
    const initializeMiniKit = async () => {
      try {
        // Aqui seria a inicialização real do MiniKit
        // await MiniKit.init({ appId: MINIKIT_CONFIG.appId });
        
        // Simular delay de inicialização
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setState(prev => ({
          ...prev,
          isInitialized: true,
        }));
      } catch (error) {
        console.error('Erro ao inicializar MiniKit:', error);
      }
    };

    initializeMiniKit();
  }, []);

  const connect = async () => {
    try {
      // Simular conexão com World ID
      // const result = await MiniKit.walletAuth();
      
      // Simular dados do usuário
      const mockUser = {
        worldId: 'mock_world_id_123',
        walletAddress: '0x742d35Cc6634C0532925a3b8D0C1C6C3f6c3c0b8',
      };

      setState(prev => ({
        ...prev,
        isConnected: true,
        user: mockUser,
      }));
    } catch (error) {
      console.error('Erro ao conectar com MiniKit:', error);
    }
  };

  const disconnect = () => {
    setState(prev => ({
      ...prev,
      isConnected: false,
      user: null,
    }));
  };

  return {
    ...state,
    connect,
    disconnect,
  };
} 