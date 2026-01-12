#!/bin/bash

echo "Enviando codigo para GitHub..."

git remote set-url origin https://github.com/engsoftcaiocoblaprofissional/SLO-e-saude-agentes-LLM.git

git branch -M main

git push -u origin main

echo "Concluido!"
