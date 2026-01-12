#!/bin/bash

echo "=== Enviando para GitHub ==="
echo ""

REPO="https://github.com/engsoftcaiocoblaprofissional/SLO-e-saude-agentes-LLM.git"

echo "1. Verificando repositorio..."
git remote set-url origin $REPO 2>/dev/null || git remote add origin $REPO

echo "2. Status atual:"
git status --short

echo ""
echo "3. Tentando fazer push..."
echo "   (Se pedir credenciais, use seu token do GitHub)"
echo ""

git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "=== Sucesso! ==="
    echo "Repositorio: $REPO"
else
    echo ""
    echo "=== Para fazer upload via GitHub Desktop ==="
    echo "1. Abra GitHub Desktop"
    echo "2. File -> Add Local Repository"
    echo "3. Selecione: $(pwd)"
    echo "4. Clique em 'Publish branch'"
fi
