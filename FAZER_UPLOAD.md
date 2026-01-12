# Como Fazer Upload para GitHub

## Opcao 1: Script Automatico (Recomendado)

Execute no terminal:

```bash
./upload-github.sh
```

Quando pedir credenciais:
- Username: `engsoftcaiocoblaprofissional`
- Password: Use um Personal Access Token (veja como criar abaixo)

## Opcao 2: Comando Direto

```bash
git push -u origin main
```

## Opcao 3: Com Token na URL (Mais Seguro)

1. Crie um Personal Access Token em: https://github.com/settings/tokens
2. Execute:

```bash
git remote set-url origin https://SEU_TOKEN@github.com/engsoftcaiocoblaprofissional/SLO-e-saude-agentes-LLM.git
git push -u origin main
```

## Como Criar Personal Access Token

1. Acesse: https://github.com/settings/tokens
2. Clique em "Generate new token" -> "Generate new token (classic)"
3. Nome: "SLO Gateway"
4. Selecione escopo: `repo` (todas as opcoes de repo)
5. Clique em "Generate token"
6. COPIE o token imediatamente (nao aparece novamente)

## Status Atual

- Todos os arquivos commitados
- Remote configurado
- Pronto para push
- Apenas falta autenticacao

## Verificar Status

```bash
git status
git log --oneline -5
git remote -v
```
