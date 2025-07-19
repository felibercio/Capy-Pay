'use client';
import { MiniKitProvider } from '@/lib/minikit-mock';
import { PropsWithChildren } from 'react';

export function Providers({ children }: PropsWithChildren) {
  return (
    <MiniKitProvider>
      {children}
    </MiniKitProvider>
  );
} 