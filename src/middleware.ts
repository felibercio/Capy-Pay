import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Regras: bloquear acesso ao dashboard sem carteira vinculada e sem token
  if (pathname.startsWith('/dashboard')) {
    const walletConnected = req.cookies.get('wallet_connected')?.value === 'true';
    const walletAddress = req.cookies.get('wallet_address')?.value;
    const accessToken = req.cookies.get('capypay_access_token')?.value;
    // Permitir acesso se houver token (custodial) OU carteira não-custodial conectada
    const allowByToken = !!accessToken;
    const allowByWallet = walletConnected && !!walletAddress;
    if (!allowByToken && !allowByWallet) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('requireWallet', '1');
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};