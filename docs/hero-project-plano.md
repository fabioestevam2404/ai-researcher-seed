# Hero Project — Plano de Execução
### Módulo Capstone · Pós-Graduação em Engenharia AI-Native · UNIPDS

---

## 1. O projeto

**AI Researcher** — chatbot consultor de investimentos. Consulta base vetorial de demonstrações financeiras, identifica contexto insuficiente, busca na web, persiste o enriquecimento e responde com citação e data-base.

- Construído fim a fim em vídeo, do zero ao deploy.
- Deploy em produção na Unidade 1. Todo commit em `main` vai para URL pública.
- Os outros três projetos: apenas diagrama de arquitetura + mock de tela. Sem código.
- Fine-Tuning não é coberto pelo Capstone.

---

## 2. Ementa

| Unidade | Carga | Foco |
|---|---|---|
| 1 — Ideação, Setup e Deploy Inicial | 1h | Starter Kit, AI Dev Skills, Deploy Zero em Cloud Run |
| 2 — Orquestração Cognitiva e APIs | 1,5h | LangGraph.js, tool calling, RAG com fallback, upsert retroativo |
| 3 — Qualidade, Resiliência e MCP | 1,5h | Testes automatizados, circuit breaker, degradação graciosa, servidor MCP |
| 4 — Frontend Design e Integração | 1,5h | Google Stitch, Frontend Skills, UI reativa em Angular 22 |
| 5 — Observabilidade e Produção | 1,5h | Langfuse, Grafana, rate limiting, canary e rollback |
| 6 — Empacotamento, Demo e Comunidade | 1h | README, showcase, submissão, clean-up |
| | **8h** | |

---

## 3. Arquitetura — 100% Google Cloud

```
Firebase Hosting (Angular 22)
        │ SSE
Cloud Run (Fastify + LangGraph.js) ──► Vertex AI
        │                                ├─ grade      gemini-3.5-flash-lite
        │                                ├─ answer     gemini-3.6-flash
        │                                └─ embeddings gemini-embedding-001
        │                          ──► Google Custom Search / Serper
        │
   Cloud SQL Postgres + pgvector

Secret Manager · Artifact Registry · Cloud Monitoring
Langfuse Cloud · Grafana Cloud
GitHub Actions ──(Workload Identity Federation)──► deploy
```

**Modelos:** apenas versões estáveis, nunca preview — modelo em preview é descontinuado com duas semanas de aviso, o que inviabilizaria material gravado. Um modelo por papel, definido por variável de ambiente: o nó `grade` roda alto volume e classificação simples, o nó `answer` exige qualidade de citação. A diferença de custo entre os dois aparece no trace do Langfuse e é conteúdo da Unidade 5.

**Padrão do agente:** Corrective RAG como grafo explícito em LangGraph.js.

```
retrieve → grade → [suficiente]   → answer
                 → [insuficiente] → web_search → upsert → (loop, máx. 2)
```

---

## 4. Corpus e pipeline de ingestão

### 4.1 Escopo

**Fonte única: CVM Dados Abertos.** Apenas empresas da B3, apenas dados estruturados. Sem narrativas.

20 empresas, últimos 4 trimestres — 80 documentos indexados.

| Setor | Empresas |
|---|---|
| Bancos | ITUB, BBDC, BBAS |
| Energia elétrica | ELET, EGIE, CMIG |
| Petróleo | PETR, PRIO |
| Mineração e siderurgia | VALE, GGBR, CSNA |
| Varejo | MGLU, LREN, ASAI |
| Alimentos e bebidas | ABEV, JBSS, BRFS |
| Papel e celulose | SUZB, KLBN |
| Tecnologia | TOTS |

Dois ou mais concorrentes por setor viabilizam perguntas comparativas dentro do corpus.

### 4.2 Fonte

CVM Dados Abertos — formulários ITR (trimestrais) e DFP (anuais). Arquivos ZIP anuais contendo CSVs com plano de contas padronizado. Público, gratuito, sem restrição de licença.

Uma única fonte elimina: mapeamento entre padrões contábeis distintos, conversão de moeda, divergência de calendário fiscal, extração de HTML não padronizado e necessidade de embedding multilíngue.

### 4.3 Etapas do pipeline

**1. Tabela de empresas**
Arquivo versionado no repositório com 20 linhas: ticker, razão social, código CVM, setor. Escrito uma vez, à mão.

**2. Coleta**
Download dos ZIPs anuais da CVM, extração dos CSVs e filtro pelos 20 códigos. Os CSVs relevantes são os de DRE (resultado), BPA (ativo), BPP (passivo) e DFC (fluxo de caixa), em versão consolidada.

**3. Normalização**
Extração dos indicadores por código de conta do plano padronizado, convergindo para um schema único:

`receita_liquida` · `lucro_bruto` · `lucro_liquido` · `ativo_total` · `patrimonio_liquido` · `caixa_operacional`

Único tratamento necessário: a CVM publica valores em milhares de reais.

**4. Geração dos parágrafos indexáveis**
Um parágrafo por empresa e trimestre, produzido por **template determinístico** — não por LLM. Inclui valores absolutos, margens e variações trimestral e anual.

> *"No 3T25, a Vale reportou receita líquida de R$ X bilhões, alta de Y% frente ao 3T24 e queda de Z% frente ao 2T25. O lucro líquido foi de R$ W bilhões, com margem líquida de V%. O caixa gerado nas operações somou R$ U bilhões."*

Geração determinística garante reprodutibilidade, custo zero e ausência de alucinação numérica. O texto indexado deriva de dado estruturado, nunca de extração de tabela em PDF.

**5. Chunking e embeddings**
Um chunk por parágrafo, sem fragmentação — cada parágrafo é autocontido. Embeddings gerados pelo Vertex AI.

**6. Metadados obrigatórios**

`ticker` · `company_name` · `setor` · `period` · `period_end` · `source_url` · `fetched_at`

Sustentam três funções: filtro na recuperação, citação com data-base na resposta, e política de expiração dos documentos inseridos pela busca web.

### 4.4 Efeito sobre o comportamento do agente

O corpus passa a conter exclusivamente números. Toda pergunta qualitativa — motivo de uma queda de margem, guidance, fato relevante, posição de mercado — cai no fallback para busca web.

Isso torna a demonstração do Corrective RAG mais nítida, com uma fronteira clara e fácil de explicar em aula:

| Tipo de pergunta | Caminho |
|---|---|
| Quanto, quando, comparação numérica | Corpus responde |
| Por que, o que muda, notícia recente | Busca web |
| Recomendação de compra ou venda | Recusa por guardrail |

### 4.5 Separação entre coleta e carga

A coleta roda **uma vez, offline**, e produz JSONs normalizados versionados no repositório. Os ZIPs originais não são commitados.

```
pnpm collect   # apenas na preparação do material — acessa a CVM
pnpm seed      # executado pelo aluno — lê os JSONs e popula o pgvector
```

O aluno nunca acessa a CVM. O seed é reprodutível, offline e leve.

### 4.6 Guardrail regulatório

O sistema é informativo, não recomendatório (atividade regulada pela CVM). Disclaimer persistente na interface e teste automatizado que verifica ausência de recomendação de compra ou venda.

---

## 5. Evidências de produção

Nove itens verificáveis em tela. Base da rubrica de avaliação.

| # | Evidência | Unidade |
|---|---|---|
| 1 | URL pública com HTTPS respondendo | 1 |
| 2 | Deploy automatizado sem chave estática (WIF) | 1 |
| 3 | Segredos fora do repositório (Secret Manager) | 1 |
| 4 | Testes bloqueando o deploy no CI | 3 |
| 5 | Falha externa não derruba o serviço | 3 |
| 6 | Traces com custo e latência por requisição | 5 |
| 7 | Rate limiting com alerta de abuso | 5 |
| 8 | Rollback executado ao vivo | 5 |
| 9 | Custo por pergunta conhecido | 5 |

---

## 6. `pnpm capstone:check`

Comando no Starter Kit, executado pelo aluno contra a própria URL de produção. Gera bloco em Markdown para colar no Discord junto com a submissão.

```bash
pnpm capstone:check --url https://meu-projeto.run.app
```

```
━━━━ CAPSTONE CHECK · @fulano ━━━━
Projeto: AI Researcher          12/03 14:32

✅  1. Endpoint público          203ms · HTTPS válido
✅  2. Deploy automatizado       há 2h · GitHub Actions
✅  3. Segredos protegidos       nenhuma credencial exposta
✅  4. Testes no CI              23/23 · bloqueando merge
✅  5. Degradação graciosa       busca off → 200 com aviso
✅  6. Observabilidade           47 traces em 24h
⚠️   7. Rate limiting             sem alerta configurado
✅  8. Rollback disponível       3 revisions ativas
❌  9. Custo por pergunta        métrica não exposta
✅ 10. Guardrail                 recusa corretamente
✅ 11. README com diagrama       presente
❌ 12. Showcase                  URL não informada

SCORE: 9/12
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

| # | Método |
|---|---|
| 1 | `GET /health` — status, latência, certificado |
| 2 | API do GitHub — workflow de deploy com execução recente |
| 3 | Varredura do repositório por padrões de credencial |
| 4 | API do GitHub — teste passou e é *required check* |
| 5 | `POST /chat` simulando falha externa; espera 200, não 5xx |
| 6 | API do Langfuse — traces nas últimas 24h |
| 7 | Rajada de requisições; espera 429 e alerta configurado |
| 8 | `gcloud run revisions list` — mais de uma revision ativa |
| 9 | `/metrics` expõe custo agregado por requisição |
| 10 | Envia "devo comprar X?" e verifica ausência de recomendação |
| 11 | README com seção de arquitetura e diagrama |
| 12 | URL do vídeo presente e acessível |

**Implementação:** script Node.js no monorepo, sem serviço central. Credenciais são as locais do aluno; nada é transmitido a terceiros.

**Entrega faseada:** primeira edição cobre os itens 1, 2, 3, 4, 11 e 12 — apenas HTTP e API do GitHub. Itens 5 e 10 na segunda rodada. Itens 6, 7, 8 e 9 conforme evolução.

---

## 7. Custos

| Recurso | Custo |
|---|---|
| Cloud Run | ~R$ 0 (free tier) |
| **Cloud SQL** | **US$ 10–15/mês — único custo fixo** |
| Vertex AI | Coberto por crédito de trial |
| Custom Search | Gratuito até 100 queries/dia |
| Langfuse / Grafana Cloud | Free tier |

Clean-up via `make destroy`, entregue como comando executável e não como instrução no README.

---

## 8. Cronograma de desenvolvimento

| Fase | Entrega | Tag | Unidade |
|---|---|---|---|
| 0 | Fundação GCP: projeto, APIs, Cloud SQL com pgvector, WIF | — | pré-requisito |
| 0b | Pipeline de coleta CVM e geração do corpus | — | pré-requisito |
| 1 | Walking skeleton + Deploy Zero | `v1` | 1 |
| 2 | Grafo do agente sobre o corpus | `v2` | 2 |
| 3 | Testes + resiliência + MCP | `v3` | 3 |
| 4 | Frontend Angular + painel de estado do grafo | `v4` | 4 |
| 5 | Observabilidade + canary + rollback | `v5` | 5 |
| 6 | Documentação + showcase + clean-up | `v6` | 6 |

Cada fase é uma tag Git alinhada a uma unidade. O `git diff` entre tags é material didático complementar ao vídeo.

**Práticas de produção:** construir duas vezes (passada exploratória, depois histórico limpo); congelar respostas de APIs externas como fixtures antes de gravar; cronometrar a Fase 0 em ambiente limpo — acima de 20 minutos, o provisionamento vira pré-requisito assíncrono.
