'use client';

import { MiniKitProvider } from '@worldcoin/minikit-js';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MiniKitProvider
      appId={process.env.NEXT_PUBLIC_MINIKIT_APP_ID || 'app_staging_123'}
      defaultSigningKey={process.env.NEXT_PUBLIC_MINIKIT_SIGNING_KEY || 'key_123'}
    >
      {children}
    </MiniKitProvider>
  );
} 