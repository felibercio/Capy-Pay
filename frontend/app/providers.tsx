'use client';

import MiniKitProvider from '../components/minikit-provider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MiniKitProvider>
      {children}
    </MiniKitProvider>
  );
}