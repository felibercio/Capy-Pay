/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpilação de packages para resolver problemas de compatibilidade
  transpilePackages: [
    '@base-org/account',
    '@base-org/account-ui', 
    '@base-org/account-ui-react',
    '@coinbase/onchainkit',
    '@worldcoin/minikit-js',
    'react-icons',
  ],

  // Configuração do webpack para ignorar diretórios específicos
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/frontend/**', '**/node_modules/**', '**/.git/**']
    };
    return config;
  },
  
  // Permitir requisições para o backend local durante desenvolvimento
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
  
  // Headers CORS para desenvolvimento
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig; 