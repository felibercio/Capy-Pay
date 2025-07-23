#!/bin/bash

echo "🚀 Setup Automático - Capy Pay Demo"
echo "=================================="

# Verificar se está na pasta correta
echo "📍 Verificando localização..."
pwd

# Criar .env.local
echo "⚙️ Criando arquivo de configuração..."
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:3001" > .env.local
echo "✅ Arquivo .env.local criado"

# Limpar e reinstalar dependências do frontend
echo "🧹 Limpando dependências antigas..."
rm -rf node_modules
rm -f package-lock.json

echo "📦 Instalando dependências do frontend..."
npm cache clean --force
npm install

# Setup do backend
echo "🔧 Configurando backend..."
cd backend
npm install
cd ..

echo "✅ Setup concluído!"
echo ""
echo "🚀 Para iniciar a demonstração:"
echo "Terminal 1: cd backend && npm run demo"
echo "Terminal 2: npm run dev"
echo "Navegador: http://localhost:3000" 