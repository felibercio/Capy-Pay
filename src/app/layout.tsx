import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Capy Pay - Pagamentos Cripto Simples',
  description: 'Pague boletos e faça transferências com cripto de forma fácil e rápida',
  icons: {
    icon: '/capy-favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-capy-teal min-h-screen">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
} 