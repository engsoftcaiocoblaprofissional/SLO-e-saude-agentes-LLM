#!/bin/bash

echo "=== Upload para GitHub ==="
echo ""

REPO_URL="https://github.com/engsoftcaiocoblaprofissional/SLO-e-saude-agentes-LLM.git"

echo "1. Verificando repositorio Git..."
if [ ! -d .git ]; then
    echo "   Inicializando repositorio..."
    git init
fi

echo "2. Configurando remote..."
git remote remove origin 2>/dev/null
git remote add origin $REPO_URL

echo "3. Adicionando todos os arquivos..."
git add .

echo "4. Fazendo commit..."
git commit -m "SLO Eval Gateway - Sistema completo" 2>/dev/null || echo "   (Nenhuma mudanca para commitar)"

echo "5. Configurando branch main..."
git branch -M main

echo "6. Tentando fazer push..."
echo ""
echo "   Se pedir credenciais:"
echo "   - Username: engsoftcaiocoblaprofissional"
echo "   - Password: Use um Personal Access Token"
echo "   - Criar token em: https://github.com/settings/tokens"
echo ""

git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "=== Sucesso! Codigo enviado para GitHub ==="
    echo "Repositorio: $REPO_URL"
else
    echo ""
    echo "=== Erro ao fazer push ==="
    echo "Verifique suas credenciais e tente novamente"
    echo "Ou execute manualmente: git push -u origin main"
fi
