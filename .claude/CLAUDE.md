# CLAUDE.md

## Contexto

Este repositório é o **AI Researcher**, projeto demonstrativo do módulo Capstone da Pós-Graduação em Engenharia AI-Native da UNIPDS.

**O código é material didático.** Ele será lido linha a linha por alunos e explicado em vídeo. Isso muda o critério de qualidade: clareza vence concisão, explícito vence esperto, e uma abstração só se justifica quando tem dois ou mais usos reais. Código correto porém difícil de narrar é código a ser reescrito.

O histórico de commits também é material — cada fase é uma tag Git, e o `git diff` entre tags é conteúdo de aula. Commits devem contar a história na ordem em que ela será ensinada.

**O que a aplicação faz:** chatbot consultor de investimentos. Consulta uma base vetorial de indicadores financeiros de 20 empresas da B3, avalia se o contexto recuperado é suficiente, busca na web quando não é, persiste o enriquecimento e responde com citação e data-base.

---

## Estado atual do repositório

Bloco 0 (fundação) está pronto: monorepo pnpm workspaces + Turborepo (`package.json`, `pnpm-workspace.yaml`, `turbo.json`), tooling (`tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.editorconfig`) e `packages/contracts` (schema zod de `/health`).

Bloco B (corpus CVM) está pronto e fechado: `packages/corpus` coleta ITR/DFP direto de `dados.cvm.gov.br`, normaliza e gera os 80 documentos (`packages/corpus/data/documentos/{TICKER}.json`, 20 empresas × 4 trimestres) com o parágrafo determinístico já embutido. Rodar `pnpm collect` de novo busca os trimestres mais recentes disponíveis na hora — os arquivos em `data/documentos/` são o snapshot da última coleta, e são versionados. B.6 (conferência manual dos números contra os releases oficiais, via `pnpm --filter @hero/corpus run report [TICKER...]`) e B.7 (revisão do `evals/dataset.json`, 27 perguntas nos grupos A/B/C) foram concluídos por revisão humana — o dataset é considerado definitivo.

Ainda não existem `apps/`, `packages/agent`, `packages/mcp-server`, `infra/` nem `scripts/` — cada um nasce no seu próprio bloco (ver `docs/hero-project-tarefas.md`): `apps/api` e `apps/web` no Bloco C, `packages/agent` no D, `packages/mcp-server` no E, `docker-compose.yml`/`Dockerfile` também no C. Bloco A (fundação GCP) também não começou.

O restante deste arquivo — Stack, Estrutura, Comandos — descreve o **estado-alvo** completo do projeto, não o estado atual. `pnpm dev` já existe como script (delega para `turbo run dev`), mas não há nenhum pacote com tarefa `dev` ainda — só terá efeito a partir do Bloco C. `pnpm seed` e `pnpm capstone:check` ainda não existem como script; cada um é adicionado quando o bloco que o implementa chega (D.2, C.7/H.3, respectivamente).

**Achado do Bloco B que vale saber antes de mexer no coletor:** o código de conta padronizado da CVM (`CD_CONTA`) não é estável entre setores — bancos têm uma árvore de DRE/BPP diferente da industrial, e até dois bancos entre si divergem na posição do lucro líquido. `packages/corpus/src/collect/select-quarters.ts` busca `lucro_liquido` e `patrimonio_liquido` por texto de `DS_CONTA` (com `ST_CONTA_FIXA=S`) por causa disso — não volte a usar código fixo pra esses dois campos sem reler o comentário no topo do arquivo.

O plano de execução completo (ementa, arquitetura, cronograma por tag Git, checklist do `capstone:check`) está em `docs/hero-project-plano.md`. A quebra em tarefas por bloco, com a ordem de dependência entre elas, está em `docs/hero-project-tarefas.md` — comece por lá para saber o que fazer a seguir.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| API | Fastify + TypeScript |
| Orquestração | LangGraph.js |
| Frontend | Angular 22 (standalone, signals) |
| Banco | Postgres + pgvector (Cloud SQL) |
| LLM e embeddings | Vertex AI via LangChain.js |
| Busca web | Custom Search / Serper, atrás de interface |
| Tools | MCP (stdio + Streamable HTTP) |
| Testes | Vitest + Playwright |
| Observabilidade | Langfuse, Prometheus, Grafana Cloud |
| Deploy | Cloud Run + Firebase Hosting, via GitHub Actions |

---

## Estrutura

```
apps/
  api/            Fastify, rotas, bootstrap
  web/            Angular
packages/
  agent/          grafo, nós, prompts, providers
  mcp-server/     registro das tools
  contracts/      schemas zod compartilhados
  corpus/         coleta CVM, normalização, geração de parágrafos
infra/            Dockerfile, workflows, IaC
evals/            dataset de perguntas e runner
scripts/          capstone:check, seed, destroy
```

Regra de dependência: `apps/*` pode importar `packages/*`; `packages/*` nunca importa `apps/*`. `contracts` não importa ninguém.

---

## Comandos

```bash
pnpm dev              # api + web em watch
pnpm build            # build de tudo
pnpm test             # unitários
pnpm test:e2e         # Playwright
pnpm lint             # ESLint + Prettier
pnpm collect          # coleta CVM — só na preparação do material
pnpm seed             # popula pgvector a partir dos JSONs versionados
pnpm capstone:check   # verificações de produção
```

---

## Regras de trabalho

**Pergunte antes de:**
- Instalar qualquer dependência nova.
- Criar uma abstração, interface ou camada que ainda não tem dois usos concretos.
- Alterar o schema do banco ou os schemas em `contracts`.
- Mudar configuração de deploy, workflow ou infraestrutura.
- Reorganizar pastas ou mover arquivos entre pacotes.

**Nunca:**
- Escrever segredo, chave ou connection string em arquivo versionado. Tudo vem de variável de ambiente, e em produção do Secret Manager.
- Commitar os ZIPs ou CSVs brutos da CVM. Apenas os JSONs normalizados são versionados.
- Usar LLM para gerar os parágrafos do corpus. São determinísticos, por template.
- Adicionar `any` sem comentário justificando. `unknown` com narrowing é preferível.
- Escrever teste que depende de rede. Use fixtures ou fakes.

---

## Convenções

**TypeScript**
- `strict: true`. Sem `any` implícito.
- Validação de entrada com zod na fronteira (rota HTTP, tool MCP, leitura de arquivo). Dentro do domínio, confie nos tipos.
- Erros de domínio são classes nomeadas, não strings. A API responde em `application/problem+json`.

**Nomes**
- Arquivos em `kebab-case`. Tipos e classes em `PascalCase`. Funções e variáveis em `camelCase`.
- Nós do grafo têm nome de verbo: `retrieve`, `grade`, `webSearch`, `answer`.

**Testes**
- Unitário para tudo que é determinístico: normalizador, gerador de parágrafos, chunker, parser.
- Comportamento do grafo é testado com LLM fake, nunca com chamada real.
- Um teste de guardrail é obrigatório e não pode ser removido.

**Commits**
- Mensagem no imperativo, em português, sem prefixo convencional.
- Um commit resolve uma coisa. Se a mensagem precisa de "e", provavelmente são dois commits.

---

## Domínio: restrição regulatória

A consultoria de valores mobiliários é atividade regulada pela CVM. **O sistema informa, nunca recomenda.**

Na prática:
- O prompt do nó `answer` proíbe sugestão de compra, venda ou manutenção de posição.
- Toda resposta cita a fonte e o período do dado.
- Existe um teste automatizado que envia "devo comprar X?" e verifica ausência de linguagem recomendatória. Se ele quebrar, o comportamento é o problema — não o teste.
- A interface exibe disclaimer permanente.

---

## O corpus

Fonte única: CVM Dados Abertos, formulários ITR e DFP. 20 empresas da B3, últimos 4 trimestres.

Indicadores extraídos: `receita_liquida`, `lucro_bruto`, `lucro_liquido`, `ativo_total`, `patrimonio_liquido`, `caixa_operacional`. A CVM publica em milhares de reais — a conversão acontece na normalização, uma única vez.

Cada empresa e trimestre vira **um parágrafo autocontido**, gerado por template determinístico, indexado como um chunk sem fragmentação.

Metadados obrigatórios em todo documento: `ticker`, `company_name`, `setor`, `period`, `period_end`, `source_url`, `fetched_at`.

O corpus contém apenas números. Perguntas qualitativas caem no fallback para busca web — isso é intencional e é o que a aula demonstra.

---

## Modelos

**Regra: apenas modelos estáveis.** Modelos em preview são descontinuados com duas semanas de aviso — inaceitável para material gravado que fica no ar por meses. A família Gemini 2.5 está em processo de aposentadoria e não entra no projeto.

| Papel | Modelo | Por quê |
|---|---|---|
| Nó `grade` | `gemini-3.5-flash-lite` | Classificação com saída estruturada. Alto volume, baixa complexidade — é onde o custo se multiplica pelo loop |
| Nó `answer` | `gemini-3.6-flash` | Equilíbrio entre velocidade e qualidade. Precisa acertar citação e respeitar o guardrail |
| Embeddings | `gemini-embedding-001` | Estável e adequado a RAG. O `gemini-embedding-2-preview` é multimodal, mas preview |

**Nome de modelo nunca é hardcoded.** Cada papel tem sua própria variável de ambiente:

```
MODEL_GRADE=gemini-3.5-flash-lite
MODEL_ANSWER=gemini-3.6-flash
MODEL_EMBEDDING=gemini-embedding-001
```

Duas razões: o material sobrevive à troca de modelo sem regravação, e a comparação de custo por nó — visível no trace do Langfuse — é conteúdo da Unidade 5.

Trocar o modelo de embedding invalida o índice inteiro. Se acontecer, o `pnpm seed` precisa rodar de novo do zero.

**Nota:** o Vertex AI vem sendo renomeado para Gemini Enterprise Agent Platform. As URLs da documentação mudaram; a API permanece a mesma.

---

## Skills

O repositório usa duas origens de skills, e a distinção é intencional — ela é parte do conteúdo da Unidade 1.

**Oficiais do Angular**, mantidas pelo time do framework e atualizadas a cada release:

```bash
npx skills add https://github.com/angular/skills
```

- `angular-developer` — geração de código e orientação arquitetural: componentes, serviços, reatividade (signals, `linkedSignal`, `resource`), formulários, injeção de dependência, roteamento, SSR, acessibilidade, animações, estilo, testes e CLI.
- `angular-new-app` — criação de aplicação nova via Angular CLI.

**Do repositório**, em `.claude/skills/`, cobrindo apenas o que é específico deste projeto:

- `fastify-route` — validação, problem+json, SSE.
- `langgraph-node` — assinatura de nó, estado, arestas condicionais, testabilidade.
- `angular-component` — store, consumo de SSE, painel do grafo, disclaimer.

Regra de precedência: em conflito entre uma skill oficial e uma do repositório sobre idioma do framework, **a oficial vence**. Skills próprias descrevem decisões deste projeto, não regras da biblioteca.

---

## Observação sobre versões

As versões de Angular, LangGraph.js e dos modelos do Vertex AI mudam com frequência. Ao encontrar divergência entre este arquivo e a API real da biblioteca, siga a biblioteca e avise, em vez de forçar o padrão descrito aqui.
