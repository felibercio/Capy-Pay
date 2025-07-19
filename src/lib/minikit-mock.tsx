// Mock do MiniKit para desenvolvimento local
// Este arquivo simula as funcionalidades do @worldcoin/minikit-js

import React from 'react';

export interface MiniKitUser {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
}

export interface MiniKitContext {
  user?: MiniKitUser;
  isInstalled: boolean;
  isReady: boolean;
}

// Mock dos hooks do MiniKit
export const useMiniKit = () => {
  return {
    isInstalled: true,
    isReady: true,
    isInitialized: true,
    isConnected: true,
    user: {
      id: 'mock-user-123',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      profilePictureUrl: 'https://via.placeholder.com/150'
    },
    context: {
      user: {
        id: 'mock-user-123',
        username: 'testuser'
      }
    }
  };
};

export const useAddFrame = () => {
  return {
    addFrame: () => {
      console.log('[MiniKit Mock] Add frame called');
      return Promise.resolve();
    }
  };
};

export const useOpenUrl = () => {
  return {
    openUrl: (url: string) => {
      console.log('[MiniKit Mock] Opening URL:', url);
      window.open(url, '_blank');
    }
  };
};

export const useViewProfile = () => {
  return {
    viewProfile: (userId: string) => {
      console.log('[MiniKit Mock] View profile:', userId);
    }
  };
};

export const useClose = () => {
  return {
    close: () => {
      console.log('[MiniKit Mock] Close called');
    }
  };
};

export const usePrimaryButton = () => {
  return {
    setPrimaryButton: (config: any) => {
      console.log('[MiniKit Mock] Set primary button:', config);
    }
  };
};

export const useNotification = () => {
  return {
    sendNotification: (notification: any) => {
      console.log('[MiniKit Mock] Send notification:', notification);
      return Promise.resolve();
    }
  };
};

// Mock do Provider
export const MiniKitProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

// Export default para simular o módulo completo
const MiniKit = {
  install: () => {
    console.log('[MiniKit Mock] Install called');
  },
  isInstalled: () => true,
  user: {
    id: 'mock-user-123',
    username: 'testuser'
  }
};

export default MiniKit; 