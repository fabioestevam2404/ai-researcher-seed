# Especificação — AI Researcher

> Fonte de verdade do **o quê** e do **porquê**. Decisões técnicas ficam em [plan.md](plan.md); a ordem de execução, em [tasks.md](tasks.md).
> Base: [README.md](../README.md) (arquitetura-alvo), material da disciplina UNIPDS 11 (Aulas 1–24) e o estado do projeto-base AI Researcher Seed.

## 1. Problema

Pessoas que pesquisam empresas listadas na B3 precisam de indicadores financeiros confiáveis, com fonte e data-base, sem que a ferramenta recomende operações. Recomendar compra, venda ou manutenção de ativos é atividade regulada pela CVM.

## 2. Objetivo

Um assistente de pesquisa que:

1. responde com base em dados públicos da CVM (ITR e DFP) recuperados de uma base vetorial;
2. julga se o contexto recuperado basta e, quando não basta, complementa com busca na web;
3. cita fonte, empresa, período e data-base de cada informação;
4. **nunca** recomenda decisão de investimento, com uma proteção implementada em código;
5. mostra ao usuário as etapas executadas;
6. oferece a mesma capacidade a outros agentes por MCP.

## 3. Fora de escopo

- Recomendação, opinião, previsão de preço ou carteira.
- Histórico de conversas, autenticação de usuários finais e multiusuário.
- Dados além dos seis indicadores e das 20 empresas do corpus do Seed.
- Geração de parágrafos do corpus por LLM.
- Treinamento ou ajuste fino de modelos.

## 4. Atores

| Ator | Interação |
| --- | --- |
| Usuário do chat | Pergunta pela interface web e lê resposta, fontes e etapas. |
| Cliente MCP | Outro agente que chama a tool `perguntar`. |
| Operador | Executa coleta, carga, deploy, consulta métricas e encerra o ambiente. |

## 5. Requisitos funcionais

### RF-01 Corpus CVM (já entregue pelo Seed — validar)

- Lista de 20 empresas em `data/empresas.csv` (ticker, razão social, código CVM, setor).
- Indicadores dos 4 últimos trimestres disponíveis: receita líquida, lucro bruto (quando aplicável), lucro líquido, ativo total, patrimônio líquido, caixa operacional.
- Valores normalizados de milhares de reais para reais; indicador ausente é `null`, nunca `0`.
- Um JSON por empresa com `ticker`, `company_name`, `setor`, `period`, `period_end`, `source_url`, `fetched_at` e `paragraph` gerado por template determinístico.
- Arquivo anual ausente na CVM (ex.: 404) é ignorado sem interromper a coleta.

### RF-02 Base vetorial

- Tabela `documentos` com colunas do corpus, indicadores `bigint`, `embedding vector(768)`, índice único `(ticker, period)` e índice HNSW por cosseno.
- Tabela `documentos_web` com `query`, `title`, `content`, `source_url`, `fetched_at`, `expires_at` e `embedding vector(768)`.
- Seed idempotente: rodar duas vezes não duplica registros (upsert por `(ticker, period)`).
- Embeddings gerados em lotes de 10, com o **mesmo modelo** na carga e na consulta, fixado em 768 dimensões.

### RF-03 Recuperação (`retrieve`)

- Gera o embedding da pergunta e devolve os top-k (k = 5) documentos mais próximos por distância de cosseno.
- Combina `documentos` e `documentos_web` não expirados, ordenando só por distância.
- Cada documento retorna sua origem (`cvm` ou `web`) e a similaridade (`1 − distância`).

### RF-04 Avaliação (`grade`)

- Saída estruturada `{ sufficient: boolean, missingAspects: string[] }`.
- Nenhum documento recuperado → insuficiente.
- Pergunta numérica coberta por empresa, indicador e período presentes → suficiente.
- Pergunta qualitativa (motivo, notícia, fato relevante, guidance, previsão de preço) → insuficiente, mesmo com documento da empresa certa, com o que falta em `missingAspects`.
- Indicador, empresa ou período ausentes → insuficiente; o modelo não inventa número.

### RF-05 Busca web (`webSearch`)

- Uma query por aspecto faltante (`${pergunta} ${aspecto}`); sem aspectos, só a pergunta.
- Top 3 resultados por query; HTML buscado com timeout de 10 s; texto sem tags dividido em chunks de ~1000 caracteres com sobreposição de 100.
- Cada chunk recebe embedding e é gravado em `documentos_web` com TTL configurável (padrão 7 dias).
- Página com falha é ignorada; query com falha é ignorada; o nó nunca derruba o grafo.
- Provedor trocável por `SEARCH_PROVIDER` (`serper` padrão, `google`).

### RF-06 Grafo e limite de iterações

- `START → retrieve → grade`; de `grade`: suficiente → `answer`; insuficiente e `iterations < MAX_ITERATIONS` → `webSearch → retrieve`; limite atingido → `answer` com contexto parcial.
- `MAX_ITERATIONS = 2`, contando passagens por `grade`, via reducer do estado, sem contador externo.

### RF-07 Resposta (`answer`) e guardrail

- O prompt instrui: nunca recomendar; responder só com o contexto; não inventar, estimar ou completar número; citar empresa e período de cada número; avisar quando o contexto for incompleto e dizer o que falta.
- Filtro determinístico por expressão regular aplicado **depois** do modelo: linguagem recomendatória ("recomendo", "recomendaria", "sugiro", "sugeriria", "aconselho", "aconselharia", "vale a pena comprar/vender/manter" e variações) substitui a resposta inteira por um aviso fixo, preservando as fontes.
- Bloco "Fontes" sempre anexado, deduplicado por `source_url`: CVM → `TICKER · período (data-base AAAA-MM-DD)`; web → título.
- Texto não aprovado pelo filtro nunca é transmitido ao cliente.

### RF-08 API de chat (SSE)

- `POST /api/chat` com `{ question }` validado por zod do pacote de contratos.
- Resposta `text/event-stream`, com headers `Cache-Control: no-cache, no-transform` e `Connection: keep-alive`.
- Eventos tipados por etapa: `retrieve` (documentos resumidos), `grade` (`sufficient`, `missingAspects`, `iterations`), `webSearch` (só o nome), `answer` (texto validado), `error`.
- Cada evento de etapa inclui a duração medida no servidor (requisito do README; o curso calcula no frontend).
- Erro no meio do stream → evento `error` e encerramento da conexão; o processo nunca cai.
- A rota recebe o grafo por interface mínima (`GraphLike`) e por função memoizada (`getGraph`).

### RF-09 Erros padronizados

- Um único error handler, registrado com `setErrorHandler`.
- Formato RFC 7807 (`application/problem+json`: `type`, `title`, `status`, `detail`), schema no pacote de contratos.
- Mapeamento: `ZodError` → 400; circuito aberto → 503; rate limit → 429; orçamento excedido → 429; demais → 500 genérico, sem stack trace.

### RF-10 MCP

- Uma única tool, `perguntar`, que executa o grafo completo e devolve a resposta já citada e filtrada.
- Descrição da tool declara o domínio (20 empresas da B3, dados da CVM), a busca web complementar, a citação obrigatória e que ela nunca recomenda.
- Falha do grafo → `isError: true` com mensagem genérica.
- Transportes: stdio (uso local) e Streamable HTTP stateless (POST; GET e DELETE → 405), em servidor próprio (`MCP_HTTP_PORT`, padrão 3100) e como gateway em `/api/mcp`.
- `/api/chat` e `/api/mcp` compartilham a mesma instância do grafo (um único circuit breaker).

### RF-11 Interface web

- Chat é a rota inicial; `/health` mostra o status.
- Disclaimer fixo, sem `@if`, sem botão de fechar: "Este assistente apresenta informações públicas, não recomendação de investimento."
- Bolha do usuário à direita; do assistente à esquerda, revelada palavra por palavra (70 ms) a partir da resposta validada.
- Citações clicáveis com origem (Base local (CVM) ou host da URL), data-base e link.
- Painel do pipeline com as etapas retrieve, grade, search e answer nos estados pendente, em execução e concluído, com duração.
- Banner de fallback web em ciano (caminho normal, não erro). Verde e vermelho nunca indicam dado financeiro nem estado do pipeline.
- Enter envia; Shift+Enter quebra linha; botão desabilitado (visualmente também) com campo vazio ou resposta em andamento.
- Falha da chamada mostra mensagem fixa, nunca tela branca.

### RF-12 Modo demo

- `DEMO=true`, lida num único lugar por dependência, substitui busca web e página, embeddings (vetor de zeros), busca vetorial (documento real da Vale 3T25 congelado), grade (sempre suficiente) e answer (resposta fixa).
- O seed nunca roda em modo demo.

## 6. Requisitos não funcionais

| ID | Requisito | Critério verificável |
| --- | --- | --- |
| RNF-01 Segurança | Nenhum segredo versionado; local via `.env` gitignorado, nuvem via Secret Manager; CI autentica por WIF, sem chave JSON. | `capstone:check` "segredos protegidos" passa; varredura do histórico sem credenciais. |
| RNF-02 Resiliência | Timeout de 10 s, retry com backoff exponencial (3 tentativas), circuit breaker com resfriamento, aplicados por decorator ao provedor de busca. | Testes com relógio e espera injetados. |
| RNF-03 Degradação graciosa | Busca web sempre falhando ainda produz resposta com contexto parcial sinalizado. | Teste de ponta a ponta do grafo. |
| RNF-04 Testabilidade | Nós, grafo, rota e MCP recebem dependências por parâmetro; testes unitários sem rede. | `pnpm test` passa offline. |
| RNF-05 Observabilidade | Trace por chamada no Langfuse via callback (interceptor); OTel registrado no boot de API e dos dois transportes MCP; sem chaves, nada é registrado e o processo sobe. | Trace visível no Langfuse com modelo e custo. |
| RNF-06 Custo | Contadores Prometheus `llm_tokens_total` e `llm_cost_usd_total` a partir do `usage_metadata` real; `GET /api/metrics`; rate limit global (`RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW`, exceto `/health` e `/metrics`); orçamento diário de tokens verificado antes do primeiro byte SSE. | Testes 429 de rate limit e de orçamento. |
| RNF-07 Configuração | Modelos por variável (`MODEL_GRADE`, `MODEL_ANSWER`, `MODEL_EMBEDDING`), nunca hardcoded; `GOOGLE_CLOUD_LOCATION=global`. | Nenhum nome de modelo em código fora de exemplos e da tabela de preços. |
| RNF-08 Entrega | PR roda build, lint, tipos e testes sem publicar; push na `main` faz deploy; instalação com lockfile congelado. | Workflow verde em PR e em push. |
| RNF-09 Deploy gradual | Revisão candidata sem tráfego, smoke por URL com tag, promoção 5/25/50/100 % com gates, rollback para revisão estável identificada, frontend publicado após o backend. Ausência de dados não aprova promoção. | Rollback exercitado ao menos uma vez. |
| RNF-10 Tempo de stream | SSE dentro do limite de 60 s do Firebase Hosting, ou chamada direta ao Cloud Run com CORS restrito. | Pergunta com 2 iterações termina abaixo de 60 s. |
| RNF-11 Qualidade de código | TypeScript sem `any` não justificado; zod nas fronteiras; erros como classes nomeadas. | Lint e revisão. |

## 7. Critérios de aceite (cenários)

| # | Dado / Quando | Então |
| --- | --- | --- |
| CA-01 | "Qual foi a receita líquida da Vale no 3T25?" | Responde com o valor do corpus, cita `VALE3 · 3T25 (data-base 2025-09-30)`, painel mostra retrieve → grade → answer, sem search. |
| CA-02 | "Qual foi o último fato relevante da Vale?" | grade insuficiente, webSearch executa, resposta cita fonte web, banner de fallback aparece. |
| CA-03 | Mesma pergunta qualitativa repetida dentro do TTL | Documentos web vêm do banco e a web não é consultada de novo. |
| CA-04 | "Eu devo comprar a Vale no preço atual?" | Nenhuma recomendação chega ao usuário; aviso fixo com fontes. |
| CA-05 | LLM fake devolve "Eu recomendo comprar PETR4 agora" | Filtro substitui pelo aviso fixo (teste obrigatório, não removível). |
| CA-06 | Grade fake sempre insuficiente | Grafo para em exatamente 2 passagens por grade e responde com contexto parcial. |
| CA-07 | Provedor de busca sempre falhando | Grafo termina em answer com resposta real e aviso de contexto incompleto. |
| CA-08 | Body vazio em `/api/chat` | 400 em `application/problem+json`. |
| CA-09 | Rota inexistente | 404 no formato padronizado. |
| CA-10 | Excesso de requisições / orçamento diário estourado | 429 antes de qualquer byte SSE. |
| CA-11 | Cliente MCP chama `perguntar` | Recebe resposta citada; erro do grafo vira `isError: true` genérico. |
| CA-12 | E2E Playwright com `DEMO=true` | Disclaimer visível; resposta contém "R$ 56,7 bilhões"; citação mostra data-base 2025-09-30, origem "Base local (CVM)" e link do ZIP; painel termina em 3 etapas. |
| CA-13 | Seed executado duas vezes | Contagem de `documentos` igual nas duas execuções. |
| CA-14 | `capstone:check` contra a URL de produção | Todas as verificações aprovadas (o Seed prevê 12). |
| CA-15 | Gate de canary falha | 100 % do tráfego volta à revisão estável e o smoke passa. |

## 8. Premissas e pendências

- O Seed já contém blocos A–C (fundação, corpus revisado, infra GCP, walking skeleton e deploy). A importação e a verificação desse estado são a primeira tarefa.
- O `CLAUDE.md` do Seed vale como regra de trabalho: perguntar antes de nova dependência, abstração, schema, contrato, infra ou mudança de pastas.
- Valores esperados de CA-01/CA-12 dependem do corpus coletado; se a CVM tiver publicado novos trimestres, ajustar a fixture congelada, não o teste.
- Abertas, a decidir pelo responsável (ver plan.md §9): política de acesso do `/api/mcp` público, limites numéricos dos gates de canary e do orçamento diário, e uso de Hosting ou Cloud Run direto para o SSE.
