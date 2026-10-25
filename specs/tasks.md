# Tarefas — AI Researcher

> Derivadas de [spec.md](spec.md) e [plan.md](plan.md). Cada fase termina com testes verdes e uma tag Git. `[P]` = pode rodar em paralelo com a anterior da mesma fase. Marque `[x]` ao concluir.
> Regra do Seed: perguntar antes de adicionar dependência, criar abstração, mudar schema, contrato, infra ou mover arquivos.

## Fase 0 — Importação e verificação do Seed (bloqueante)

- [x] **T001** pnpm 11.20.0 disponível via `corepack pnpm`. Pendente para você: `corepack enable` no seu terminal (no sandbox deu EPERM).
- [x] **T002** Seed importado com histórico; `origin` aponta para o seu repositório; README e `specs/` preservados.
- [x] **T003** CLAUDE.md, skills, tarefas do autor e workflow lidos; divergências registradas no plan.md §1.
- [x] **T004** `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm lint`: 4 pacotes compilam, 16 testes e lint verdes com Node 24.15.0.
- [ ] **T004a** No seu terminal, `node -v` ainda mostra 22.13.1: remover `...\nvm\v22.13.1` do PATH do sistema e rodar `nvm use 24.15.0` + `corepack enable` como administrador.
- [ ] **T005** Criar `docs/diagrams/*.mmd` com os três blocos Mermaid do README e renderizar SVG (mermaid-cli 12.0.0). Aceite: blocos e `.mmd` idênticos.
- [x] **T006** `/api/health` → `ok/ok` com o banco no ar e `degraded/error` com ele parado, sem derrubar o processo. Nesta máquina a porta 5432 já está ocupada (contêiner `ouvidoria_db` e outro Postgres), então o pgvector local roda como `ai-researcher-postgres` em `127.0.0.1:5433` e só o `.env` local aponta para ela. (Aula 7)
- [x] **T007** `.env.example` versionado e `dev` da API carregando `../../.env` com `tsx --env-file-if-exists` (lacuna do Seed em relação ao prompt da Aula 7).

## Fase 1 — Infra GCP e deploy zero (se ainda não provisionado na sua conta)

- [x] **T010** `gcloud` 590.0.0 instalado; os dois logins feitos (`festevam30@gmail.com`); ADC com quota project. `gh` em instalação.
- [x] **T011a** `.firebaserc` → `ai-researcher-fabio`; projeto + billing + APIs; Vertex AI verificado; Artifact Registry; WIF + SA de deploy (valores no plan.md §1). (Aula 6)
- [x] **T011b** `gh` 2.103.0 + login (`fabioestevam2404`); variáveis `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT` criadas no repositório.
- [x] **T011c** Firebase adicionado pelo console (termos aceitos); site `https://ai-researcher-fabio.web.app`. Plano Blaze com crédito de teste válido até 2027-01-21.
- [x] **T011d** Cloud SQL `ai-researcher-db` (Postgres 16, `db-f1-micro`, 10 GB SSD, sem backup, proteção contra exclusão); banco `ai_researcher`; `vector` 0.8.5; `app_user` com senha aleatória que só existe no secret `database-url` (socket Unix); `cloudsql.client` na SA de deploy; `secretAccessor` na SA de execução. Migrations e seed aplicados via Cloud SQL Auth Proxy: 80/80 documentos, 768 dimensões.
- [x] **T011e** Alerta de orçamento `ai-researcher-fabio-mensal`: R$ 100/mês, avisos em 50/90/100 %, **excluindo créditos** (mede o consumo bruto).
- [x] **T012** Deploy verde (run `39980373363`, após conceder `serviceUsageConsumer`): API em `ai-researcher-api-00002-n57`, site no ar; acesso público liberado com confirmação explícita (2026-10-23); produção `/api/health` → `ok/ok`; `capstone:check` 3/3. Tag `v1`. (Aula 7)

## Fase 2 — Corpus e base vetorial

- [ ] **T020** Testes de `parse-csv.ts` com fixture binária latin1 real. (Aula 14)
- [ ] **T021** [P] Testes de `select-quarters.ts`: conta por setor, fallback consolidado/individual, versão retificada numérica, subtração YTD do 4T, ano bissexto, ausente ≠ 0. (Aula 14)
- [x] **T022** `packages/agent` criado; Drizzle 0.45.4 / drizzle-kit 0.31.11; schema `documentos` (indicadores `bigint` anuláveis, `vector(768)`, único `(ticker, period)`, HNSW por cosseno); migrations `0000_habilita-pgvector` e `0001_cria-documentos`; `pnpm db:migrate` na raiz, idempotente. (RF-02, Aula 8)
- [x] **T023** `criarEmbeddings()` isolado (Vertex AI via `@langchain/google-vertexai` 2.3.4, `dimensions: 768`, modelo por `MODEL_EMBEDDING`).
- [x] **T024** `pnpm seed`: lê os 80 JSONs, valida com zod, lotes de 10, upsert por `(ticker, period)`. CA-13 verificado (80 → 80); busca por cosseno traz `VALE · 3T25` em 1º (0,891). 5 testes com fakes.
- [ ] **T025** `test:integration`: migration, upsert idempotente e consulta por cosseno no Postgres do compose. (D-16)

## Fase 3 — Nós retrieve, grade e busca web

- [x] **T030** `db/retrieve-similar.ts` + nó `retrieve` (factory, top-k 5, similaridade = 1 − distância). Teste com fakes. (RF-03, Aula 9)
- [x] **T031** `prompts/grade.ts` + nó `grade` com saída estruturada `{sufficient, missingAspects}`; testes do prompt e do nó. (RF-04)
- [x] **T032** `search/`: `SearchProvider`, Serper, Google CSE, `criarSearchProvider()`; testes com `vi.stubGlobal`. (RF-05, Aula 10)
- [x] **T033** Tabela `documentos_web` (query, title, content, source_url, fetched_at, expires_at, `vector(768)` + HNSW) na migration `0002`, aditiva; aplicada no Postgres local. Origem identificada pela tabela, sem coluna nova em `documentos`. **Aplicar no Cloud SQL antes do deploy do grafo (T045).** (Aula 11)
- [x] **T034** Nó `webSearch`: queries por aspecto, top 3, fetch com timeout 10 s, extração de texto (sem menu/rodapé), chunks 1000/100 (máx. 10 por página), descarte de páginas com < 500 caracteres, um lote de embedding por query, gravação com TTL de 7 dias; falhas de página ignoradas; `buscarPagina` e relógio injetáveis. Teste real: 2 páginas do RI da Vale, 8 chunks. (RF-05)
- [x] **T035** Busca combina CVM + web não expirada (`expires_at > now()`) e corta no top-k só pela similaridade; `DocumentoRecuperado` vira união `cvm | web`; prompt do grade marca `[CVM]`/`[WEB]` e aceita trecho web para pergunta qualitativa. Real: trecho web aparece enquanto válido e some ao expirar. Observação: para "último fato relevante da Vale" a busca trouxe a página-índice do RI, sem o fato em si — o grade corretamente manteve "insuficiente" (candidato a caso de avaliação em `evals`).

## Fase 4 — Grafo, answer e SSE

- [x] **T040** `graph.ts` com `StateGraph`, reducer de `iterations`, `MAX_ITERATIONS = 2`, `GraphDeps` por função. Testes: caminho direto, loop, guard (CA-06). (RF-06, Aula 12)
- [x] **T041** `prompts/answer.ts` + nó `answer` + `answer/format-resposta.ts` (regex, aviso fixo, bloco Fontes deduplicado). Testes: resposta normal, CA-05 (obrigatório), prompt instrui a não recomendar, variações e pedidos disfarçados. Canal `answerText`. (RF-07, Aula 13)
- [x] **T042** Contratos `ChatRequest` e `ChatEvent` (com `durationMs`). ⚠ contrato.
- [x] **T043** `POST /api/chat` SSE com headers manuais, `GraphLike`, evento `error` sem derrubar o processo. Teste com grafo fake. (RF-08)
- [x] **T044** Teste manual local com Vertex real: CA-01, CA-02, CA-04. Tag `v2`. Feito via `POST /api/chat` em 2026-10-23. O CA-02 revelou dois defeitos, corrigidos antes da tag: `iterations` do evento do grade vinha como incremento (agora é o total) e o mesmo trecho web, gravado por buscas repetidas, ocupava várias vagas do top-k (agora deduplicado na leitura). A gravação ainda duplica a página a cada busca dentro do TTL — resolver junto com o CA-03 (não buscar de novo o que ainda vale).
- [x] **T045** ⛔ **Gate de produção do `/api/chat` — bloqueia o push da `main` que leva a rota ao Cloud Run.** Desde a T012 o serviço `ai-researcher-api` está público (`allUsers` → `run.invoker`); com o `/api/chat`, qualquer pessoa geraria custo de Vertex AI. Antes desse push, cumprir **uma** das saídas:
  1. Antecipar a T093 (rate limit global + orçamento diário de tokens verificado antes do primeiro byte SSE) e incluir os testes de 429 no mesmo push; **ou**
  2. Revogar o acesso público (`gcloud run services remove-iam-policy-binding ai-researcher-api --region=us-central1 --member=allUsers --role=roles/run.invoker`) até a T093 existir.
  Aceite: escolha registrada aqui, e `curl -X POST https://ai-researcher-fabio.web.app/api/chat` em produção devolve 429 depois do limite (saída 1) ou 403 (saída 2).
  **Escolha (2026-10-23): saída 2.** `allUsers` revogado; `/api/health` e `/api/chat` respondem 403 tanto no Cloud Run direto quanto via Firebase Hosting. O `deploy.yml` não usa `--allow-unauthenticated`, então novos deploys mantêm o serviço fechado. Efeito colateral aceito: o `capstone:check` (item 1, endpoint público) falha até a T093 existir — reabrir o acesso só junto com ela.

## Fase 5 — Qualidade e resiliência

- [x] **T050** Modo demo da busca web: fixtures Vale/Petrobras/Klabin do `evals/dataset.json` + genérica; `DEMO` lido em um só lugar; `.env.example`. (RF-12, Aula 14) Conteúdo das fixtures é fictício e se declara assim (título `[DEMO]`, domínio `demo.ai-researcher.invalid`, aviso no texto). Ainda grava em `documentos_web`: depois de usar o demo, limpar com `DELETE FROM documentos_web WHERE source_url LIKE 'https://demo.ai-researcher.invalid/%'` — a T080 deve impedir essa gravação.
- [x] **T051** Timeout `AbortSignal` nos providers + `comResiliencia()` (retry, backoff, circuit breaker) com relógio injetável. (RNF-02, Aula 15) 3 tentativas (esperas de 500 e 1000 ms), só para rede/timeout/429/5xx; circuito abre após 3 buscas falhas seguidas e fica 30 s fechado para chamadas; a primeira busca depois disso decide se fecha ou reabre.
- [x] **T052** try/catch por query no `webSearch`; teste E2E do grafo com provider sempre falhando (CA-07). (RNF-03)
- [x] **T053** Error handler central + schema `Problem` em contratos; mapeamento 400/503/500; teste do duck typing do circuito; remover tratamento por rota. Aceite: CA-08, CA-09. (RF-09, Aula 16)

## Fase 6 — MCP

- [x] **T060** `getRealGraph` memoizado em `packages/agent` (clientes de embeddings, grade e answer reutilizáveis). (D-10) Antecipada na T043 (`real-graph.ts`).
- [x] **T061** `packages/mcp-server`: tool `perguntar`, descrição para o agente, `GetGraph` por parâmetro, `isError` genérico; teste com `InMemoryTransport`; transporte stdio; `claude mcp add`. ⚠ dependência MCP SDK. (RF-10, Aula 17) SDK `@modelcontextprotocol/sdk` 1.32.1 aprovado em 2026-10-23. Stdio validado com cliente MCP real (CA-01 com citação). Registro no Claude Code, depois de `pnpm build`: `claude mcp add ai-researcher -- node --env-file=<repo>/.env <repo>/packages/mcp-server/dist/stdio.js`.
- [x] **T062** Streamable HTTP stateless: `mcpHttpPlugin`, servidor standalone (3100) e gateway `/api/mcp`; superfície de biblioteca sem efeitos colaterais. Resposta em JSON (`enableJsonResponse`), GET/DELETE → 405. O standalone escuta só em `127.0.0.1` (sem autenticação). `fastify` 5.11.2 entrou no `mcp-server` (mesma versão da API). ⚠ **O `/api/mcp` vai junto quando o acesso público do Cloud Run for reaberto: a T093 (rate limit e orçamento) precisa cobrir `/api/mcp` além do `/api/chat`** (plan.md §9, item 1).
- [x] **T063** `/api/chat` passa a receber `getGraph`; `getChatGraph` e `getMcpGraph` usam a mesma `getRealGraph`. Teste de instância única. Aceite: CA-11. Tag `v3`. CA-11 validado com grafo real pelos três transportes (stdio, standalone 3100 e `/api/mcp`). O `app.ts` importa o `mcpHttpPlugin` (biblioteca sem efeitos colaterais); o `@hero/agent` continua só no `index.ts`.

## Fase 7 — Frontend

- [x] **T070** Protótipo (Claude Design ou Stitch) exportado em HTML standalone em `docs/design/prototype/`. (Aula 18) Feito num canvas de design do claude.ai (duas pranchetas: resposta concluída e pergunta em andamento), aprovado em 2026-10-23.
- [x] **T071** Skill `.claude/skills/frontend-design/` a partir do protótipo; regra: só ciano como cor de estado.
- [x] **T072** Tokens globais em `styles.scss` + casca estática do chat (header, disclaimer, mensagens, composer). Header e disclaimer no `App` (todas as rotas); mensagens e composer entraram direto ligados ao store, na T076.
- [x] **T073** Rotas (`''` → Chat, `health` → Health) com `provideRouter`. (Aula 19) Rota curinga volta para o chat. A referência oficial usa `harness.router`, que não existe no Angular 22.1 — o teste injeta o `Router`.
- [x] **T074** `ChatService.ask()` (fetch + ReadableStream → AsyncGenerator de `ChatEvent`). Eventos validados com `chatEventSchema`; acento dividido entre pedaços coberto por teste.
- [x] **T075** [P] `ChatStore` (revelação 70 ms, `tokenize`, erro fixo, limpeza de timers) e `parseAnswer` com testes. Web sem data-base no rótulo: a origem é o host da URL.
- [x] **T076** Ligar o componente Chat (Enter/Shift+Enter, botão desabilitado também no visual, `@if`/`@for`). Campo com signal forms (`form()` + `[formField]`), como manda a skill oficial.
- [x] **T077** `GraphStore` (conclui última etapa e prevê próxima; espelha `MAX_ITERATIONS` sem importar `@hero/agent`) + `GraphPanelComponent` (timeline, spinner, check, duração do servidor, banner de fallback ciano). (Aula 20) O banner fica gravado em cada resposta (`buscouNaWeb`), não no estado global do painel.
- [x] **T078** Disclaimer incondicional (sem `@if`, sem fechar). Verificação no navegador. (Aula 21) Verificado no Edge headless (DevTools Protocol, sem dependência nova) com API em `DEMO=true`: andamento, resposta concluída e largura de celular, sem erro no console. A verificação revelou Markdown cru na resposta — corrigido no prompt do answer (regra 6, texto simples). ⚠ Bundle inicial com 674 kB passa do aviso de 500 kB (erro só em 1 MB): o zod dos contratos entra no navegador para validar os eventos SSE.

## Fase 8 — Demo completo e E2E

- [x] **T080** Estender `DEMO=true` ao grafo inteiro: embeddings zero, busca fixa Vale 3T25, grade sempre suficiente, answer fixa; seed nunca em demo. (RF-12) Cada fábrica (`criarEmbeddings`, `criarGradeLlm`, `criarAnswerLlm`, `criarPersistencia`, busca e página) consulta `modoDemo()`; o `real-graph.ts` não sabe que o demo existe. Demo não abre o Postgres nem grava nada (resolve a pendência da T050). API em demo validada com ambiente vazio: 3 etapas em 0,25 s.
- [x] **T081** Playwright `apps/web/e2e/chat-happy-path.spec.ts` com webServer (API demo + ng serve). Aceite: CA-12. ⚠ dependência Playwright. `@playwright/test` 1.64.0 aprovado em 2026-10-24; instalado direto, sem o `playwright-ng-schematics` que a skill oficial sugere (schematic da comunidade, mexeria no `angular.json`). `pnpm test:e2e` na raiz.
- [x] **T082** E2E no job de testes do CI. Tag `v4`. Primeira execução (run `40095554571`): passou de primeira em 10,2 s, sem retry.

## Fase 9 — Observabilidade, custo e canary

- [ ] **T090** Langfuse: OTel no boot de API e dos dois transportes MCP; `CallbackHandler` por chamada; sem chaves → no-op. Teste com `DEMO=false`. (RNF-05, Aula 22) Código pronto (`@langfuse/otel` e `@langfuse/langchain` 5.13.1, `@opentelemetry/sdk-node` 0.223.0, `exportMode: 'immediate'` por causa do Cloud Run). ⏳ Falta o trace real: depende de conta e chaves do Langfuse.
- [x] **T091** `prom-client`: `llm_tokens_total`, `llm_cost_usd_total`, callback por `runId` a partir de `usage_metadata`, tabela de preços; callbacks somados no call site. (RNF-06, Aula 23) `ContadorDeTokens` no agente (modelo por `ls_model_name`); os mesmos tokens alimentam métricas e orçamento. ⚠ Preços em `apps/api/src/metricas.ts` vêm de agregadores (página oficial ilegível em 2026-10-24): conferir no console do Google.
- [x] **T092** `GET /api/metrics` com interface mínima do Registry.
- [x] **T093** Rate limit (`@fastify/rate-limit`, opções calculadas no `build()`, isenção `/health` e `/metrics`) + orçamento diário em memória antes do primeiro byte SSE; mapear 429 no error handler. Aceite: CA-10. Rate limit global (um balde só): por IP seria contornável, porque atrás do Hosting o IP vem num cabeçalho forjável. 429 do orçamento com `Retry-After` até a meia-noite UTC.
- [x] **T094** Decidir pendências §9 do plan (acesso MCP, SSE via Hosting, limites). Decidido em 2026-10-24 — ver plan.md §9.
- [x] **T094a** Chat em produção (2026-10-25): migration 0002 aplicada no Cloud SQL; secret `serper-api-key` (accessor só para a SA do Cloud Run); `deploy.yml` passa `MODEL_*`, `GOOGLE_CLOUD_*`, `SEARCH_PROVIDER`; senha do `app_user` rotacionada (vazou na saída da sessão; versão 1 do secret desativada); `allUsers` reaberto — saída 1 da T045 cumprida pela T093. Verificado pelo Hosting: health `ok/ok`, 429 em problem+json com `Retry-After`, `/api/metrics` isento (200), `/api/mcp` desligado (404), tokens reais por modelo nas métricas (~2,7 mil tokens e ~US$ 0,005 por pergunta direta). RNF-10: pior caso (2 iterações + busca web) com ~9,2 s no servidor, bem abaixo dos 60 s. ⚠ Nesta máquina o SSE chega todo de uma vez, também direto no Cloud Run (primeiro byte ≈ total); suspeita: inspeção HTTPS do Kaspersky. Confirmar pelo navegador de outra rede (celular no 4G) antes de mexer no serviço.
- [ ] **T095** `deploy.yml` canary: candidata `--no-traffic --tag`, smoke, 5/25/50/100 com gates, rollback para revisão estável explícita, frontend após backend, deploys serializados (`concurrency`). ⚠ workflow. (RNF-09)
- [ ] **T096** Exercitar rollback com gate forçado a falhar. Aceite: CA-15.
- [ ] **T097** `capstone:check` 11/11 em produção (CA-14). Tag `v5`.

## Fase 10 — Documentação e encerramento

- [ ] **T100** Atualizar README: comandos reais, status, roadmap marcado; diagramas Mermaid (nó `agentGraph`, não `graph`) renderizados.
- [ ] **T101** Rodar `evals/dataset.json` e registrar resultado.
- [ ] **T102** Encerrar o projeto GCP pelo console ao fim do laboratório (janela de 30 dias) após preservar o necessário.

## Rastreabilidade

| Requisito | Tarefas |
| --- | --- |
| RF-01 | T020, T021 |
| RF-02 | T022–T025, T033 |
| RF-03 | T030, T035 |
| RF-04 | T031 |
| RF-05 | T032, T034 |
| RF-06 | T040 |
| RF-07 | T041 |
| RF-08 | T042, T043, T063 |
| RF-09 | T053, T093 |
| RF-10 | T060–T063 |
| RF-11 | T070–T078 |
| RF-12 | T050, T080 |
| RNF-01 | T011, T012, T097 |
| RNF-02/03 | T051, T052 |
| RNF-05/06 | T090–T093 |
| RNF-08/09/10 | T012, T082, T094–T097 |
