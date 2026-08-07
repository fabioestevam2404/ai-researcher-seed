# Hero Project — Plano de Tarefas
### Desenvolvimento do AI Researcher · anterior à roteirização

---

## Como este plano funciona

Oito blocos. Cada bloco fecha em uma tag Git e adiciona suas próprias verificações ao `capstone:check` — o check cresce junto com o projeto, e cada fase se autotesta.

**Caminho crítico:** Bloco 0 → (A ‖ B) → C → D → E → F → G → H.
Os blocos A e B são independentes entre si e podem correr em paralelo.

**Construir duas vezes — apenas onde há incerteza real.** Passada exploratória seguida de passada limpa se aplica ao coletor da CVM (B.2 → B.3) e ao grafo do agente (D.4 → D.11). O resto é código previsível; fazer duas vezes seria desperdício.

**Esforço total estimado:** 55–70 horas.

---

## Bloco 0 — Fundação do repositório

Primeiro de tudo, porque o `CLAUDE.md` é o que orienta todas as sessões seguintes de Claude Code.

| # | Tarefa | Pronto quando |
|---|---|---|
| 0.1 | Monorepo pnpm workspaces + Turborepo, estrutura de pastas | `pnpm build` roda em todos os pacotes |
| 0.2 | `CLAUDE.md` — stack, convenções, comandos, restrições | Contém o que o agente nunca deve fazer sem perguntar |
| 0.3 | Skills oficiais do Angular (`npx skills add`) + `.claude/skills/` próprias: `fastify-route`, `langgraph-node`, `angular-component` | Skills oficiais instaladas; cada skill própria tem regra + exemplo bom e ruim, sem duplicar o que a oficial cobre |
| 0.4 | Tooling: TypeScript, ESLint, Prettier, Vitest, editorconfig | `pnpm lint` e `pnpm test` verdes num projeto vazio |
| 0.5 | `packages/contracts` com schemas zod compartilhados | Um tipo cruza API → web e quebra o build se divergir |

**~4h**

---

## Bloco A — Fundação GCP  *(paralelo com B)*

| # | Tarefa | Pronto quando |
|---|---|---|
| A.1 | Projeto GCP, billing, APIs habilitadas | `gcloud services list` mostra Run, SQL, Vertex, Secret Manager |
| A.2 | Artifact Registry criado | `docker push` de imagem dummy funciona |
| A.3 | Cloud SQL Postgres + `CREATE EXTENSION vector` | `SELECT * FROM pg_extension` confirma |
| A.4 | Secret Manager com os segredos iniciais | Nenhuma credencial em arquivo local |
| A.5 | Workload Identity Federation para o GitHub Actions | Workflow autentica sem chave de service account |
| A.6 | Firebase Hosting inicializado | Página estática no ar |
| A.7 | **Cronometrar o bloco inteiro do zero** e registrar em `infra/README.md` | Tempo medido em conta limpa |

**~6h** · A.7 decide se o provisionamento cabe na Unidade 1 ou vira pré-requisito assíncrono.

---

## Bloco B — Corpus CVM  *(paralelo com A)*

Trabalho local; só depende do GCP na hora de gerar embeddings.

| # | Tarefa | Pronto quando |
|---|---|---|
| B.1 | Tabela das 20 empresas: ticker, razão social, código CVM, setor | CSV versionado, escrito à mão |
| B.2 | **Spike do coletor** — baixar um ZIP e mapear o layout real dos CSVs | Entendimento do plano de contas documentado |
| B.3 | `pnpm collect` — download, extração, filtro pelos 20 códigos | Roda do zero e produz dados brutos |
| B.4 | Normalizador → schema canônico, JSONs versionados no repo | 20 empresas × 4 trimestres, escala corrigida |
| B.5 | Gerador determinístico de parágrafos + snapshot tests | Mesma entrada produz byte a byte a mesma saída |
| B.6 | **Conferência manual de 5 empresas contra o release oficial** | Divergência zero nos seis indicadores |
| B.7 | Dataset de ~25 perguntas nos grupos A (corpus), B (web), C (recusa) | Versionado, com resposta esperada |

**~10h** · B.6 é o controle de qualidade mais importante do projeto. Número errado no corpus contamina tudo o que vem depois e só aparece na gravação.

---

## Bloco C — Fase 1: Walking skeleton + Deploy Zero → `v1`

Zero IA. O objetivo é a esteira funcionando ponta a ponta.

| # | Tarefa | Pronto quando |
|---|---|---|
| C.1 | `apps/api` Fastify com `GET /health` | Responde local |
| C.2 | `apps/web` Angular 22 criado com a skill oficial `angular-new-app`, consumindo `/health` | Mostra o status na tela |
| C.3 | Dockerfile multi-stage + `docker-compose.yml` (postgres/pgvector local, api, web) | `docker compose up` sobe tudo local; Postgres do compose é efêmero e nunca é o Cloud SQL |
| C.4 | GitHub Actions: test → build → push → deploy Cloud Run | Push em `main` chega à URL pública |
| C.5 | Deploy do Angular no Firebase Hosting pelo mesmo workflow | Front e API no ar |
| C.6 | Conexão Cloud Run ↔ Cloud SQL validada | `/health` inclui checagem de banco |
| C.7 | `capstone:check` v0 — itens 1, 2, 3 | CLI roda e emite bloco Markdown |

**~8h** · Tag `v1` · O Postgres do `docker-compose` é local — o Cloud SQL do Bloco A só passa a ser usado a partir de C.6, na validação do deploy real.

---

## Bloco D — Fase 2: Grafo do agente → `v2`

Metade do esforço técnico do projeto.

| # | Tarefa | Pronto quando |
|---|---|---|
| D.1 | Schema pgvector + migrations + índice HNSW | Migration reproduzível |
| D.2 | `pnpm seed` — lê JSONs, gera embeddings, popula | Roda offline, sem acessar a CVM |
| D.3 | Nó `retrieve` + endpoint de debug | Retorna top-k com metadados |
| D.4 | **Spike do grafo completo** — descartável | Fluxo end-to-end funcionando, sem preocupação com forma |
| D.5 | Nó `grade` com saída estruturada `{ sufficient, missing_aspects[] }` | Classifica corretamente o dataset B.7 |
| D.6 | `SearchProvider` — interface + Custom Search + Serper | Troca por variável de ambiente |
| D.7 | Nó `web_search` → extração → chunk → upsert com metadata e TTL | Documento inserido é recuperável na pergunta seguinte |
| D.8 | Aresta condicional + loop com `max_iterations: 2` | Guard testado; não há laço infinito |
| D.9 | Nó `answer` com citações obrigatórias e guardrail de recomendação | Toda resposta cita fonte e data-base |
| D.10 | Streaming SSE em `POST /chat` | Sem buffering no Cloud Run |
| D.11 | **Passada limpa** — reescrever o grafo em commits legíveis | `git log` conta a história na ordem certa |

**~20h** · Tag `v2` · D.1 e D.2 devem rodar sem alteração contra o Postgres local do `docker-compose` e contra o Cloud SQL — a única diferença é o valor de `DATABASE_URL`.

---

## Bloco E — Fase 3: Qualidade, resiliência e MCP → `v3`

| # | Tarefa | Pronto quando |
|---|---|---|
| E.1 | Testes unitários: normalizador, gerador, chunker, parser | Cobertura nas partes determinísticas |
| E.2 | **Fake LLM + teste de roteamento do grafo** | `sufficient: false` prova passagem por `web_search` |
| E.3 | Teste de guardrail — "devo comprar X?" | Asserção de ausência de recomendação |
| E.4 | Fixtures das APIs externas + modo `DEMO=true` | Demo reproduzível sem rede |
| E.5 | Timeout, retry com backoff e circuit breaker no `SearchProvider` | Falha simulada não propaga |
| E.6 | Degradação graciosa | Busca fora do ar → 200 com aviso, nunca 5xx |
| E.7 | Erros padronizados (problem+json) | Formato único em toda a API |
| E.8 | `packages/mcp-server` — tools com schemas zod | Descrições revisadas; são prompt, não documentação |
| E.9 | Transporte stdio validado no Claude Desktop | `claude mcp add` e conversa funcionando |
| E.10 | Transporte Streamable HTTP + gateway para o Angular | Mesmas tools, duas portas |
| E.11 | CI com testes como *required check* | Merge bloqueado se falhar |
| E.12 | `capstone:check` itens 4, 5, 10 | Três verificações novas passando |

**~12h** · Tag `v3` · E.4 já entrega o congelamento de fixtures previsto nas práticas de produção.

---

## Bloco F — Fase 4: Frontend → `v4`

| # | Tarefa | Pronto quando |
|---|---|---|
| F.1 | Protótipo no Google Stitch | Telas exportadas antes de qualquer código |
| F.2 | Skill `frontend-design` com tokens e regras | Gera componente aderente ao protótipo |
| F.3 | Chat com streaming | Resposta aparece token a token |
| F.4 | Citações clicáveis com data-base | Abre a fonte; mostra o período do dado |
| F.5 | Painel de estado do grafo em tempo real | `retrieve → grade → search → answer` visível |
| F.6 | Disclaimer persistente | Sempre na tela, não em modal dispensável |
| F.7 | Playwright — caminho feliz | Roda no CI |

**~10h** · Tag `v4`

---

## Bloco G — Fase 5: Observabilidade e produção → `v5`

| # | Tarefa | Pronto quando |
|---|---|---|
| G.1 | Langfuse instrumentado por nó do grafo | Trace mostra custo e latência de cada nó |
| G.2 | `/metrics` com custo agregado por pergunta | Número conhecido, não estimado |
| G.3 | Grafana Cloud + datasource Cloud Monitoring, dashboard como código | Provisionado por arquivo, não clicado |
| G.4 | Rate limiting + budget de tokens por dia | 429 no limite configurado |
| G.5 | Alerta de abuso + script de carga | Alerta dispara em execução controlada |
| G.6 | Canary + rollback testado | Revision defeituosa revertida em um comando |
| G.7 | `capstone:check` itens 6, 7, 8, 9 | Doze verificações completas |

**~10h** · Tag `v5`

---

## Bloco H — Fase 6: Empacotamento → `v6`

| # | Tarefa | Pronto quando |
|---|---|---|
| H.1 | README com diagramas Mermaid: grafo e deploy | Renderiza no GitHub |
| H.2 | `make destroy` | Remove todos os recursos, Cloud SQL primeiro |
| H.3 | `capstone:check` itens 11, 12 + formatação final da saída | Bloco pronto para colar no Discord |
| H.4 | Branch `starter` derivado da `v1` + `capstone:check` completo | É o que o aluno clona |
| H.5 | **Validação em conta GCP limpa**, do clone ao deploy | Executado por alguém que não escreveu o código |

**~6h** · Tag `v6`

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Números errados no corpus | B.6 — conferência manual contra release oficial |
| Layout da CVM diferente do esperado | B.2 é spike explícito, antes de escrever o coletor definitivo |
| Fase 0 longa demais para a Unidade 1 | A.7 cronometra; acima de 20 min vira pré-requisito assíncrono |
| Grafo difícil de narrar linearmente | D.11 reescreve em commits legíveis, na ordem da aula |
| API externa instável durante gravação | E.4 congela fixtures e entrega modo `DEMO` |
| "Funciona na minha máquina" | H.5 valida em conta limpa, com outra pessoa |

---

## Antes de começar

**Angular 22** é a versão do projeto, desde o primeiro commit. O app é criado com a skill oficial `angular-new-app`, e as skills oficiais do time do Angular são instaladas no Bloco 0:

```bash
npx skills add https://github.com/angular/skills
```

Confirmar as versões atuais de LangGraph.js e a estrutura vigente dos arquivos da CVM. São os pontos que mais mudam e que definem o `package.json` e o coletor.

**Modelos definidos:** `gemini-3.5-flash-lite` no nó `grade`, `gemini-3.6-flash` no nó `answer`, `gemini-embedding-001` para embeddings — todos estáveis, todos por variável de ambiente. Confirmar disponibilidade na região do projeto antes do Bloco A, já que a cobertura por região varia por modelo.

**Para a roteirização:** a distinção entre skill mantida por terceiro (Angular) e skill própria do repositório é conteúdo da Unidade 1, e precisa aparecer no roteiro. É o exemplo mais concreto de "AI Dev Skills" previsto na ementa.

**Primeira sessão de Claude Code:** Bloco 0, começando pelo `CLAUDE.md`.
