'use client';

import React from 'react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { baseSepolia } from 'viem/chains';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_COINBASE_API_KEY || ''}
      chain={baseSepolia as any}
    >
      {children}
    </OnchainKitProvider>
  );
}