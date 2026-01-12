#!/bin/bash

# Script de inicialização do SLO Eval Gateway

echo "🚀 Inicializando SLO Eval Gateway..."

# Verificar se .env existe
if [ ! -f .env ]; then
  echo "📝 Criando arquivo .env a partir do .env.example..."
  cp .env.example .env
  echo "⚠️  Por favor, edite o arquivo .env com suas configurações"
fi

# Instalar dependências Node.js
echo "📦 Instalando dependências Node.js..."
npm install

# Instalar dependências Python
echo "📦 Instalando dependências Python..."
pip install -r requirements.txt

# Subir banco de dados
echo "🗄️  Subindo banco de dados..."
docker-compose up -d postgres redis

# Aguardar banco estar pronto
echo "⏳ Aguardando banco de dados..."
sleep 5

# Rodar migrations
echo "🔄 Rodando migrations..."
npm run migrate

echo "✅ Inicialização concluída!"
echo ""
echo "Para iniciar os serviços:"
echo "  - API: npm start"
echo "  - Python Services: cd services && uvicorn main:app --reload"
echo "  - Frontend: cd frontend && npm run dev"
echo ""
echo "Ou use docker-compose up para subir tudo"
