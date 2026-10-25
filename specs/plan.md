# Plano técnico — AI Researcher

> Como cumprir a [spec.md](spec.md). Cada decisão indica a origem (Aula do material, README ou CLAUDE.md do Seed).

## 1. Estado de partida

| Item | Situação em 2026-10-22 |
| --- | --- |
| Repositório | Histórico do Seed importado (`upstream` = unipds/ai-researcher-seed, HEAD `59ea22d`); `origin` = github.com/fabioestevam2404/ai-researcher-seed (vazio até o primeiro push). `core.autocrlf=false` local para manter LF e o Prettier verde. |
| Projeto-base (Seed) | Monorepo pnpm 11.20 + Turborepo; pacotes `@hero/api`, `@hero/web`, `@hero/contracts`, `@hero/corpus` (80 documentos versionados, 20 empresas × 4 trimestres, conferidos por humano). Blocos 0, A, B e C do plano do autor concluídos; D (agente), E (MCP), F, G e H pendentes. Plano e tarefas originais em `docs/hero-project-plano.md` e `docs/hero-project-tarefas.md`. |
| Verificação | `build`, `test` (14 testes) e `lint` verdes em api, contracts e corpus. **`@hero/web` não compila: Angular CLI exige Node ≥ 24.15** (instalado 24.13). |
| Lacunas do Seed | Sem `.env.example` e o `dev` da API não carrega `.env` (pedido no prompt da Aula 7). `.firebaserc` com `SEU_PROJECT_ID_AQUI`. O `infra/README.md` e o CLAUDE.md descrevem a infra GCP do autor do curso, não a sua. |
| Toolchain local | Git 2.56, Node 24.13, Docker 29.2 (Desktop parado). pnpm via `corepack pnpm` (o `corepack enable` falhou com EPERM no sandbox; rode-o no seu terminal). **Faltam** `gcloud` e `gh`. |

### Infra GCP desta instância (Fase 1)

| Recurso | Valor |
| --- | --- |
| Projeto | `ai-researcher-fabio` (número `862472634940`), billing `01D94C-0D71D8-C7CEA1` |
| APIs | Cloud Run, Artifact Registry, Secret Manager, IAM Credentials, STS, Vertex AI, Cloud SQL Admin, Firebase, Firebase Hosting, Billing Budgets. |
| Vertex AI | `gemini-embedding-001` (768 dim), `gemini-3.5-flash-lite` e `gemini-3.6-flash` verificados em `location=global` |
| Artifact Registry | repo Docker `ai-researcher`, `us-central1` |
| WIF | pool `github-actions-pool`, provider `github-actions-provider`, condição `assertion.repository=='fabioestevam2404/ai-researcher-seed'` |
| SA de deploy | `github-actions-deployer@ai-researcher-fabio.iam.gserviceaccount.com`: `run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser`, `secretmanager.secretAccessor`, `firebasehosting.admin`, `cloudsql.client`, `serviceusage.serviceUsageConsumer` (o `firebase deploy` consulta se a API do Hosting está habilitada e dava 403 sem ele — não consta no `infra/README` do Seed). Sem `cloudbuild.builds.editor` (o Seed builda no runner). |
| SA de execução | `862472634940-compute@developer.gserviceaccount.com`: `editor` (padrão) + `secretAccessor` no secret `database-url`. |
| Cloud SQL | `ai-researcher-db`, Postgres 16, `db-f1-micro`, `us-central1-f`, 10 GB SSD, sem backup automático, `--deletion-protection`, IP público sem redes autorizadas (acesso só via Auth Proxy / socket do Cloud Run). Banco `ai_researcher`, `vector` 0.8.5, usuário `app_user`. |
| Firebase | Site `ai-researcher-fabio.web.app`, plano Blaze (crédito de teste até 2027-01-21). |
| Orçamento | `ai-researcher-fabio-mensal`: R$ 100/mês, 50/90/100 %, excluindo créditos. |

**Como parar a cobrança do Cloud SQL:** pausar com `gcloud sql instances patch ai-researcher-db --activation-policy=NEVER` (religar com `ALWAYS`); apagar exige antes `--no-deletion-protection`; no fim do laboratório, encerrar o projeto (Aula 24).

Correspondência com o plano do autor: Fases 2–4 = Bloco D (`v2`); 5–6 = E (`v3`); 7–8 = F (`v4`); 9 = G (`v5`); 10 = H (`v6`). O `capstone:check` do Seed prevê 12 verificações (o material cita 11).

## 2. Arquitetura

Monorepo do Seed, mantido como está; novos pacotes só onde o material prevê.

```
apps/api            Fastify: /api/health, /api/chat (SSE), /api/mcp, /api/metrics, error handler
apps/web            Angular 22 standalone + signals: chat, painel do grafo, health
packages/contracts  zod: health, chat request, eventos SSE, problem+json
packages/corpus     coleta CVM (existente) + testes de parser e select-quarters
packages/agent      db (Drizzle), seed, search, nodes, prompts, answer/format, graph, llm, demo, telemetry, metrics
packages/mcp-server tool perguntar; transportes stdio e Streamable HTTP; superfície de biblioteca separada
specs/              spec, plan, tasks
.github/workflows/  deploy.yml (checks) → evolução para canary
```

Dependências entre pacotes: `apps/api` depende de `contracts` e, só no `index.ts` de composição, de `agent` e `mcp-server` (para `getRealGraph` e `mcpHttpPlugin`). Rotas recebem o grafo por tipo estrutural; não importam tipos do LangGraph. `apps/web` nunca importa `@hero/agent` (Aula 20).

## 3. Decisões

| # | Decisão | Origem / motivo |
| --- | --- | --- |
| D-01 | Partir do Seed sem reescrever o que já existe; o README local substitui o README do Seed. | README §Como começar; Aula 7. |
| D-02 | Inversão de dependência em nós, grafo, rota e MCP: factories recebem clientes por parâmetro. | Aulas 9, 12, 13, 17; testes sem rede. |
| D-03 | Drizzle para schema e migrations; consultas por SQL/operadores do Drizzle. `vector(768)`, HNSW `vector_cosine_ops`. | Aula 8. |
| D-04 | LangChain.js + Vertex AI (`@langchain/google-vertexai` ou equivalente estável); embedding com `outputDimensionality: 768`. | Aula 8; limite de 2.000 dimensões do índice. |
| D-05 | Adapter `SearchProvider` com Serper (padrão) e Google Custom Search via `fetch` nativo, sem SDK. | Aula 10. O Custom Search não aceita chaves novas; mantido só como segunda implementação. |
| D-06 | Resiliência como decorator `comResiliencia()` (retry 3×, backoff exponencial, circuit breaker) com relógio e espera injetáveis; timeout por `AbortSignal` nos providers. | Aula 15. |
| D-07 | Canal de estado do texto final chama-se `answerText` (LangGraph proíbe canal com nome de nó); o evento SSE mantém `answer`. | Aula 15. |
| D-08 | Eventos SSE: um por nó concluído, com `durationMs` medido no servidor. O frontend continua prevendo a próxima etapa, mas exibe a duração vinda do backend. | README §Contrato de execução diverge do curso (que mede no frontend); adoto o README porque a medição no servidor é a precisa. |
| D-09 | Erro de circuito aberto identificado por duck typing (`name === 'CircuitoAbertoError'`) na API. | Aula 16; mantém a API desacoplada. Risco documentado: renomear a classe quebra o mapeamento — cobrir com teste. |
| D-10 | Grafo real memoizado por processo em `packages/agent` (`getRealGraph`), construído na primeira chamada. | Aulas 17 e 19. |
| D-11 | Modo demo com uma única leitura de `DEMO` por dependência, na composição; implementações reais não sabem que ele existe. | Aulas 14 e 21. |
| D-12 | Frontend com a skill oficial Angular; skill de projeto `frontend-design` gerada a partir de protótipo HTML standalone. Skill oficial vence em ambiguidade. | Aulas 2, 18. |
| D-13 | Observabilidade: Langfuse via `@langfuse/otel` + `@langfuse/langchain` (callback como interceptor); métricas via `prom-client` em Registry próprio, callbacks somados no mesmo call site do `graph.stream()`. | Aulas 22 e 23. |
| D-14 | Orçamento diário e rate limit em memória (uma instância); estado compartilhado fica registrado como limitação para múltiplas instâncias. | README §Controles previstos. |
| D-15 | Canary implementado como evolução do `deploy.yml` em etapa própria, depois do produto funcional. O primeiro deploy estabelece a release de referência. | README §3; o curso usa deploy direto. |
| D-16 | Testes de integração com Postgres real (migrations, upsert idempotente, recuperação) em script separado `test:integration`, fora do `pnpm test` padrão; não usam rede externa. | README §Testes previstos × regra "testes sem rede" do CLAUDE.md. |

## 4. Modelo de dados

```
documentos(id, ticker, company_name, setor, period, period_end, receita_liquida, lucro_bruto,
           lucro_liquido, ativo_total, patrimonio_liquido, caixa_operacional  -- bigint, nullable
           source_url, fetched_at, paragraph, embedding vector(768))
  UNIQUE(ticker, period); HNSW(embedding vector_cosine_ops)

documentos_web(id, query, title, content, source_url, fetched_at, expires_at, embedding vector(768))
  HNSW(embedding vector_cosine_ops); filtro expires_at > now() na leitura
```

Migrations aditivas (compatíveis com duas revisões durante o canary). Alteração destrutiva fica fora do canary.

## 5. Estado do grafo

```ts
{ question: string; documents: Documento[]; sufficient: boolean;
  missingAspects: string[]; iterations: number /* reducer soma */; answerText: string }
```

`shouldContinue(state)`: `sufficient` → `answer`; `iterations >= MAX_ITERATIONS` → `answer`; senão `webSearch`.

## 6. Contratos (packages/contracts)

- `HealthResponse { status: 'ok'|'degraded'; database: 'ok'|'error' }` (existente).
- `ChatRequest { question: string (1..1000) }`.
- `ChatEvent` união discriminada por `node`: `retrieve | grade | webSearch | answer | error`, cada um com `durationMs`.
- `Problem { type; title; status; detail }`.

## 7. Variáveis de ambiente

| Variável | Uso | Onde fica |
| --- | --- | --- |
| `DATABASE_URL` | Postgres | `.env` local / Secret `database-url` |
| `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION=global` | Vertex AI | `.env` / env do Cloud Run |
| `MODEL_GRADE`, `MODEL_ANSWER`, `MODEL_EMBEDDING` | Modelos por papel | `.env` / env do Cloud Run |
| `SEARCH_PROVIDER`, `SERPER_API_KEY` (`GOOGLE_CSE_KEY`, `GOOGLE_CSE_CX`) | Busca web | `.env` / Secret Manager |
| `WEB_TTL_DAYS` (7) | TTL web | env |
| `DEMO` | Modo demo | env (nunca em produção) |
| `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` | Telemetria | `.env` / Secret Manager |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`, `DAILY_TOKEN_BUDGET` | Limites | env |
| `MCP_HTTP_PORT` (3100) | MCP standalone | env |
| GitHub vars `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT` | Deploy | Variáveis do repositório |

Nomes exatos de modelos (o material usa `gemini-3.5-flash-lite`, `gemini-3.6-flash`, `gemini-embedding-001`) devem ser confirmados no Model Garden do projeto antes do uso; só modelos estáveis.

## 8. Estratégia de testes

| Camada | Ferramenta | Técnica |
| --- | --- | --- |
| Parser CSV, select-quarters, templates, filtro, formatação | Vitest | Funções puras; fixture binária latin1 real. |
| Nós, grafo | Vitest | `fakeChatModel`, embeddings e search fakes; `app.stream()` coletando nós visitados. |
| Providers e resiliência | Vitest | `vi.stubGlobal('fetch')`; relógio e espera injetados. |
| API | Vitest + `fastify.inject` | Grafo fake via `GraphLike`; asserções em frames SSE e problem+json. |
| MCP | Vitest | `InMemoryTransport` do SDK. |
| Integração | Vitest + Postgres do compose | `test:integration` separado. |
| E2E | Playwright | API com `DEMO=true` + `ng serve`. |
| Smoke | `capstone:check` + curl | Saúde e contratos da revisão candidata. |
| Avaliação do agente | `evals/dataset.json` | Perguntas com fontes esperadas e casos insuficientes. |

Regra (Aula 15): teste que falha é corrigido no código, nunca ajustado para passar, salvo erro comprovado no teste com aprovação.

## 9. Pendências de decisão (do responsável pelo projeto)

1. **Acesso ao `/api/mcp` público** — ✅ decidido (2026-10-24): fechado em produção. O gateway só é registrado com `MCP_GATEWAY=true`; o MCP fica no stdio e no standalone local.
2. **SSE via Hosting (60 s) ou Cloud Run direto com CORS restrito.** — ✅ decidido (2026-10-24): Hosting, medindo o pior caso (2 iterações) em produção; mudar só se passar de ~45 s. Medido em 2026-10-25: ~9,2 s no servidor. Fica no Hosting.
3. **Limites numéricos** — ✅ rate limit e orçamento decididos (2026-10-24): `RATE_LIMIT_MAX=10` por `1 minute` (global) e `DAILY_TOKEN_BUDGET=300000`. Gates do canary: definir na T095, após baseline.
4. **Licença** do repositório (README §Autor).
5. **Repositório remoto**: fork do Seed ou repositório novo — define o `attribute.repository` da WIF.

## 10. Riscos

| Risco | Mitigação |
| --- | --- |
| Node 24.13 abaixo do mínimo do Angular CLI | Atualizar para ≥ 24.15 (`nvm install 24.15` ou mais recente da linha 24). Bloqueia build do web e o CI local. |
| `gcloud`/`gh` ausentes | Instalar antes da Fase 1 (infra na sua conta) e da fase 9 (canary). |
| CVM muda arquivos (ex.: ano ausente) | Coleta tolera 404 (já tratado no Seed); testes com fixture. |
| Nomes de modelos indisponíveis na região `global` | Validar no Model Garden; manter por variável. |
| Filtro regex não cobre paráfrases | Testes com variações e pedidos disfarçados; registrar limite; avaliação via `evals`. |
| Cloud Run público (`allUsers`) antes de existir rate limit | Liberado na T012 só porque a única rota é `/api/health`. A T045 bloqueia o deploy do `/api/chat` até haver rate limit + orçamento (T093) ou até o acesso público ser revogado. O alerta de orçamento avisa, não bloqueia. |
| Cloud SQL cobra parado | Alerta de faturamento; encerrar projeto ao fim (Aula 24). |
