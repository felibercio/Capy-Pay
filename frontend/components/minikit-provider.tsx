'use client';

import { type ReactNode, useEffect } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';

export default function MiniKitProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      MiniKit.install();
    } catch (err) {
      console.error('MiniKit installation failed:', err);
    }
  }, []);

  return <>{children}</>;
}