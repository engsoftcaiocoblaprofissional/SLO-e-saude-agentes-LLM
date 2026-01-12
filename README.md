# SLO Eval Gateway

Gateway profissional para LLM/Agentes com Policy Engine, Tool Firewall, Prompt Injection Shield, e SLO Monitoring.

## Arquitetura

- **Backend API (Node.js)**: Gateway principal, Policy Engine, Tool Firewall, Audit Trail
- **Serviços Python**: Prompt Injection Shield, Redaction, Eval Service, SLO Monitor
- **Frontend (Vue.js)**: Painel de controle e visualização
- **PostgreSQL**: Dados persistentes
- **Redis**: Cache e filas
- **Celery**: Processamento assíncrono

## Instalação

```bash
# Instalar dependências Node.js
npm install

# Instalar dependências Python
pip install -r requirements.txt

# Subir serviços com Docker
docker-compose up -d

# Rodar migrations
npm run migrate
```

## Uso

```bash
# Iniciar API
npm start

# Iniciar serviços Python
cd services && uvicorn main:app --reload --port 8000

# Iniciar frontend
cd frontend && npm run dev
```

## API Endpoints

- `POST /v1/runs` - Criar execução
- `POST /v1/policies` - Criar/atualizar políticas
- `POST /v1/evals/run` - Rodar testes/regressão
- `GET /v1/traces/{run_id}` - Tracing completo
- `POST /v1/approvals/{run_id}` - Aprovar/recusar ações
