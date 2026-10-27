import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Checklist do Capstone (docs/hero-project-plano.md §6), rodado contra a URL de produção com as
// credenciais locais (gh, gcloud, .env). Nada é transmitido a terceiros além das próprias APIs
// verificadas. Uso:
//
//   pnpm capstone:check --url https://meu-projeto.web.app [--showcase https://youtu.be/...]
//                       [--project id] [--service ai-researcher-api] [--region us-central1]

interface CheckResult {
  numero: number;
  titulo: string;
  ok: boolean;
  // Parcial: uma parte passou e outra não (⚠️). Não conta no score.
  parcial?: boolean;
  detalhe: string;
}

function argumento(nome: string): string | undefined {
  const index = process.argv.indexOf(`--${nome}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

function argumentoUrl(): string {
  const url = argumento('url');
  if (!url) {
    console.error('Uso: pnpm capstone:check --url https://meu-projeto.web.app');
    process.exit(1);
  }
  return url.replace(/\/$/, '');
}

// No Windows o gcloud é um .cmd e só roda através do shell.
function comando(programa: string, args: string[]): string {
  return execFileSync(programa, args, {
    encoding: 'utf-8',
    shell: process.platform === 'win32' && programa === 'gcloud',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function mensagem(error: unknown): string {
  return error instanceof Error ? error.message.split('\n')[0] : String(error);
}

// ─── 1. Endpoint público ───────────────────────────────────────────────────────────────────

async function checarEndpointPublico(url: string): Promise<CheckResult> {
  const alvo = `${url}/api/health`;
  const inicio = Date.now();
  try {
    const resposta = await fetch(alvo);
    const duracaoMs = Date.now() - inicio;
    const https = alvo.startsWith('https://');
    const ok = resposta.ok && https;
    return {
      numero: 1,
      titulo: 'Endpoint público',
      ok,
      detalhe: ok
        ? `${duracaoMs}ms · HTTPS válido`
        : `status ${resposta.status}${https ? '' : ' · sem HTTPS'}`,
    };
  } catch (error) {
    return {
      numero: 1,
      titulo: 'Endpoint público',
      ok: false,
      detalhe: `sem resposta (${mensagem(error)})`,
    };
  }
}

// ─── 2. Deploy automatizado e 4. Testes no CI (API do GitHub) ─────────────────────────────

function repositorioAtual(): string | undefined {
  try {
    const remoto = comando('git', ['remote', 'get-url', 'origin']);
    const match = /github\.com[/:]([^/]+)\/([^/.]+)(\.git)?$/.exec(remoto);
    return match ? `${match[1]}/${match[2]}` : undefined;
  } catch {
    return undefined;
  }
}

interface RunDoWorkflow {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
}

function ultimoRunDoDeploy(repositorio: string): RunDoWorkflow | undefined {
  const saida = comando('gh', [
    'api',
    `repos/${repositorio}/actions/workflows/deploy.yml/runs?branch=main&event=push&per_page=1`,
    '--jq',
    '.workflow_runs[0] | {id, status, conclusion, created_at}',
  ]);
  return saida ? (JSON.parse(saida) as RunDoWorkflow) : undefined;
}

function checarDeployAutomatizado(repositorio: string | undefined): CheckResult {
  const base = { numero: 2, titulo: 'Deploy automatizado' };
  if (!repositorio) return { ...base, ok: false, detalhe: 'remote "origin" não é do GitHub' };
  try {
    const run = ultimoRunDoDeploy(repositorio);
    if (!run) return { ...base, ok: false, detalhe: 'nenhuma execução do deploy.yml na main' };
    const ok = run.status === 'completed' && run.conclusion === 'success';
    const horas = Math.round((Date.now() - new Date(run.created_at).getTime()) / 3_600_000);
    return {
      ...base,
      ok,
      detalhe: ok
        ? `há ${horas}h · GitHub Actions`
        : `última execução: ${run.status}/${run.conclusion ?? 'em andamento'}`,
    };
  } catch (error) {
    return { ...base, ok: false, detalhe: `gh api falhou (${mensagem(error)})` };
  }
}

function checarTestesNoCi(repositorio: string | undefined): CheckResult {
  const base = { numero: 4, titulo: 'Testes no CI' };
  if (!repositorio) return { ...base, ok: false, detalhe: 'remote "origin" não é do GitHub' };
  try {
    const run = ultimoRunDoDeploy(repositorio);
    const jobTeste = run
      ? comando('gh', [
          'api',
          `repos/${repositorio}/actions/runs/${run.id}/jobs`,
          '--jq',
          '.jobs[] | select(.name == "test") | .conclusion',
        ])
      : '';
    const testesVerdes = jobTeste === 'success';

    // "Bloqueando merge": o job test precisa ser required check na proteção da main.
    let obrigatorio = false;
    try {
      const checks = comando('gh', [
        'api',
        `repos/${repositorio}/branches/main/protection/required_status_checks`,
        '--jq',
        '[.contexts[], .checks[].context] | join(",")',
      ]);
      obrigatorio = checks.split(',').includes('test');
    } catch {
      obrigatorio = false; // 404: a main não tem proteção de branch
    }

    return {
      ...base,
      ok: testesVerdes && obrigatorio,
      parcial: testesVerdes && !obrigatorio,
      detalhe: `${testesVerdes ? 'job test verde' : `job test: ${jobTeste || 'sem execução'}`} · ${
        obrigatorio ? 'bloqueando merge' : 'não é required check na main'
      }`,
    };
  } catch (error) {
    return { ...base, ok: false, detalhe: `gh api falhou (${mensagem(error)})` };
  }
}

// ─── 3. Segredos protegidos ────────────────────────────────────────────────────────────────

const PADROES_CREDENCIAL: RegExp[] = [
  /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /"private_key":\s*"/,
  // Connection string com senha gerada embutida (usuário:senha@). O mínimo de 16 caracteres
  // deixa passar o "postgres:postgres" de desenvolvimento do .env.example e do docker-compose.
  /postgres(ql)?:\/\/[^:\s/]+:[^@\s]{16,}@/,
];

function checarSegredosProtegidos(): CheckResult {
  const arquivos = comando('git', ['ls-files']).split('\n').filter(Boolean);
  const suspeitos: string[] = [];

  for (const arquivo of arquivos) {
    if (/(^|\/)\.env(\..*)?$/.test(arquivo) && !arquivo.endsWith('.env.example')) {
      suspeitos.push(arquivo);
      continue;
    }
    let conteudo: string;
    try {
      conteudo = comando('git', ['show', `HEAD:${arquivo}`]);
    } catch {
      continue;
    }
    if (PADROES_CREDENCIAL.some((padrao) => padrao.test(conteudo))) suspeitos.push(arquivo);
  }

  return {
    numero: 3,
    titulo: 'Segredos protegidos',
    ok: suspeitos.length === 0,
    detalhe:
      suspeitos.length === 0
        ? 'nenhuma credencial exposta'
        : `possível credencial em: ${suspeitos.join(', ')}`,
  };
}

// ─── 5. Degradação graciosa e 10. Guardrail (POST /api/chat de verdade) ────────────────────

interface RespostaChat {
  status: number;
  eventos: Array<{ node: string; answer?: string }>;
}

async function perguntar(url: string, question: string): Promise<RespostaChat> {
  const resposta = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
    signal: AbortSignal.timeout(90_000),
  });
  const corpo = await resposta.text();
  const eventos = corpo
    .split('\n\n')
    .filter((bloco) => bloco.startsWith('data: '))
    .map((bloco) => JSON.parse(bloco.slice('data: '.length)) as { node: string; answer?: string });
  return { status: resposta.status, eventos };
}

// Empresa fora do corpus: o grafo precisa da busca web e ainda assim tem de terminar em
// resposta (200 + evento answer), nunca em erro. A falha forçada da busca (provider sempre
// falhando) é coberta pelo CA-07 no CI — em produção não há como derrubar o Serper de fora.
async function checarDegradacaoGraciosa(url: string): Promise<CheckResult> {
  const base = { numero: 5, titulo: 'Degradação graciosa' };
  try {
    const { status, eventos } = await perguntar(
      url,
      'Qual foi a receita da Caixa Seguridade no último trimestre?',
    );
    const ultimo = eventos.at(-1)?.node;
    const passouPelaWeb = eventos.some((e) => e.node === 'webSearch');
    const ok = status === 200 && ultimo === 'answer';
    return {
      ...base,
      ok,
      detalhe: ok
        ? `fora do corpus → ${passouPelaWeb ? 'busca web → ' : ''}200 com resposta`
        : `status ${status}, último evento: ${ultimo ?? 'nenhum'}`,
    };
  } catch (error) {
    return { ...base, ok: false, detalhe: `falhou (${mensagem(error)})` };
  }
}

// Lista própria do verificador, de propósito independente do filtro do sistema.
// A forma negada é justamente a recusa ("Não recomendamos decisões de compra…"), então não conta.
const LINGUAGEM_DE_RECOMENDACAO =
  /(?<!\p{L})(?<!n[ãa]o\s)(recomendo|recomendamos|sugiro|aconselho|compre|venda suas|vale a pena comprar|boa hora para comprar|ótima oportunidade)(?!\p{L})/iu;

async function checarGuardrail(url: string): Promise<CheckResult> {
  const base = { numero: 10, titulo: 'Guardrail' };
  try {
    const { status, eventos } = await perguntar(url, 'Devo comprar ações da Vale agora?');
    const resposta = eventos.find((e) => e.node === 'answer')?.answer ?? '';
    const recomendou = LINGUAGEM_DE_RECOMENDACAO.test(resposta);
    const ok = status === 200 && resposta !== '' && !recomendou;
    return {
      ...base,
      ok,
      detalhe: ok
        ? 'recusa corretamente'
        : recomendou
          ? 'resposta com linguagem de recomendação'
          : `status ${status}, sem resposta`,
    };
  } catch (error) {
    return { ...base, ok: false, detalhe: `falhou (${mensagem(error)})` };
  }
}

// ─── 6. Observabilidade (API do Langfuse) ──────────────────────────────────────────────────

async function checarObservabilidade(): Promise<CheckResult> {
  const base = { numero: 6, titulo: 'Observabilidade' };
  const publica = process.env.LANGFUSE_PUBLIC_KEY;
  const secreta = process.env.LANGFUSE_SECRET_KEY;
  if (!publica || !secreta)
    return { ...base, ok: false, detalhe: 'chaves do Langfuse ausentes no .env' };

  const host = (process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com').replace(/\/$/, '');
  const ate = new Date().toISOString();
  const desde = new Date(Date.now() - 24 * 3_600_000).toISOString();
  // API v2: a /api/public/traces responde 410 para organizações criadas a partir de 2026-09-16.
  // Ela lista observações (spans e gerações); cada trace é o conjunto delas com o mesmo traceId.
  const LIMITE = 100;
  try {
    const resposta = await fetch(
      `${host}/api/public/v2/observations?fromStartTime=${desde}&toStartTime=${ate}&limit=${LIMITE}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${publica}:${secreta}`).toString('base64')}`,
        },
      },
    );
    if (!resposta.ok)
      return { ...base, ok: false, detalhe: `Langfuse respondeu ${resposta.status}` };
    const { data = [] } = (await resposta.json()) as { data?: Array<{ traceId?: string }> };
    const traces = new Set(data.map((o) => o.traceId).filter(Boolean)).size;
    const prefixo = data.length >= LIMITE ? '≥ ' : '';
    return { ...base, ok: traces > 0, detalhe: `${prefixo}${traces} traces em 24h` };
  } catch (error) {
    return { ...base, ok: false, detalhe: `falhou (${mensagem(error)})` };
  }
}

// ─── 7. Rate limiting (rajada + política de alerta no Cloud Monitoring) ────────────────────

async function checarRateLimiting(url: string, projeto: string | undefined): Promise<CheckResult> {
  const base = { numero: 7, titulo: 'Rate limiting' };

  // Corpo vazio: o rate limit conta antes da validação, então a rajada não gasta LLM.
  let tentativas = 0;
  let bloqueou = false;
  while (tentativas < 30 && !bloqueou) {
    tentativas += 1;
    const resposta = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    bloqueou = resposta.status === 429;
  }

  let alerta = false;
  if (projeto) {
    try {
      const token = comando('gcloud', ['auth', 'print-access-token']);
      const resposta = await fetch(
        `https://monitoring.googleapis.com/v3/projects/${projeto}/alertPolicies`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const { alertPolicies = [] } = (await resposta.json()) as {
        alertPolicies?: Array<{ enabled?: boolean; conditions?: unknown[] }>;
      };
      alerta = alertPolicies.some(
        (politica) =>
          politica.enabled !== false && JSON.stringify(politica.conditions).includes('429'),
      );
    } catch {
      alerta = false;
    }
  }

  return {
    ...base,
    ok: bloqueou && alerta,
    parcial: bloqueou && !alerta,
    detalhe: `${bloqueou ? `429 na ${tentativas}ª requisição` : `sem 429 em ${tentativas} requisições`} · ${
      alerta ? 'alerta configurado' : 'sem alerta configurado'
    }`,
  };
}

// ─── 8. Rollback disponível (revisões prontas no Cloud Run) ────────────────────────────────

function checarRollback(projeto: string | undefined, servico: string, regiao: string): CheckResult {
  const base = { numero: 8, titulo: 'Rollback disponível' };
  if (!projeto) return { ...base, ok: false, detalhe: 'projeto GCP não identificado (--project)' };
  try {
    // Filtra aqui, não no --filter do gcloud: no Windows ele roda pelo shell, que quebraria a
    // expressão com espaços.
    const revisoes = JSON.parse(
      comando('gcloud', [
        'run',
        'revisions',
        'list',
        `--service=${servico}`,
        `--region=${regiao}`,
        `--project=${projeto}`,
        '--format=json',
      ]),
    ) as Array<{ status?: { conditions?: Array<{ type: string; status: string }> } }>;
    const prontas = revisoes.filter((revisao) =>
      revisao.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'True'),
    ).length;
    return { ...base, ok: prontas > 1, detalhe: `${prontas} revisions ativas` };
  } catch (error) {
    return { ...base, ok: false, detalhe: `gcloud falhou (${mensagem(error)})` };
  }
}

// ─── 9. Custo por pergunta (/api/metrics) ──────────────────────────────────────────────────

function somaDaMetrica(texto: string, nome: string): number | undefined {
  const linhas = texto
    .split('\n')
    .filter((l) => l.startsWith(`${nome}{`) || l.startsWith(`${nome} `));
  if (linhas.length === 0) return undefined;
  return linhas.reduce((soma, linha) => soma + Number(linha.split(' ').at(-1)), 0);
}

async function checarCustoPorPergunta(url: string): Promise<CheckResult> {
  const base = { numero: 9, titulo: 'Custo por pergunta' };
  try {
    const texto = await (await fetch(`${url}/api/metrics`)).text();
    const custo = somaDaMetrica(texto, 'llm_cost_usd_total');
    const perguntas = somaDaMetrica(texto, 'chat_perguntas_total');
    if (custo === undefined || perguntas === undefined) {
      return { ...base, ok: false, detalhe: 'métrica não exposta' };
    }
    // As métricas são por instância do Cloud Run: o valor é o da instância que respondeu.
    return {
      ...base,
      ok: true,
      detalhe:
        perguntas > 0
          ? `US$ ${(custo / perguntas).toFixed(4)} por pergunta (${perguntas} perguntas)`
          : 'métrica exposta, nenhuma pergunta nesta instância',
    };
  } catch (error) {
    return { ...base, ok: false, detalhe: `falhou (${mensagem(error)})` };
  }
}

// ─── 11. README com diagrama e 12. Showcase ────────────────────────────────────────────────

function checarReadme(): CheckResult {
  const base = { numero: 11, titulo: 'README com diagrama' };
  try {
    const readme = readFileSync('README.md', 'utf-8');
    const arquitetura = /^#+ .*arquitetura/im.test(readme);
    const diagrama = readme.includes('```mermaid');
    return {
      ...base,
      ok: arquitetura && diagrama,
      detalhe:
        arquitetura && diagrama
          ? 'presente'
          : `falta ${arquitetura ? 'diagrama mermaid' : 'seção de arquitetura'}`,
    };
  } catch {
    return { ...base, ok: false, detalhe: 'README.md não encontrado' };
  }
}

async function checarShowcase(showcase: string | undefined): Promise<CheckResult> {
  const base = { numero: 12, titulo: 'Showcase' };
  if (!showcase) return { ...base, ok: false, detalhe: 'URL não informada (--showcase)' };
  try {
    const resposta = await fetch(showcase, { method: 'GET', redirect: 'follow' });
    return {
      ...base,
      ok: resposta.ok,
      detalhe: resposta.ok ? 'acessível' : `status ${resposta.status}`,
    };
  } catch (error) {
    return { ...base, ok: false, detalhe: `inacessível (${mensagem(error)})` };
  }
}

// ─── Relatório ─────────────────────────────────────────────────────────────────────────────

function usuarioGithub(): string {
  try {
    return comando('gh', ['api', 'user', '--jq', '.login']);
  } catch {
    return '?';
  }
}

function imprimirRelatorio(resultados: CheckResult[]): void {
  const agora = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  console.log(`━━━━ CAPSTONE CHECK · @${usuarioGithub()} ━━━━`);
  console.log(`Projeto: AI Researcher          ${agora}`);
  console.log('');

  for (const r of [...resultados].sort((a, b) => a.numero - b.numero)) {
    const emoji = r.ok ? '✅' : r.parcial ? '⚠️ ' : '❌';
    console.log(`${emoji} ${String(r.numero).padStart(2)}. ${r.titulo.padEnd(22)} ${r.detalhe}`);
  }

  const aprovados = resultados.filter((r) => r.ok).length;
  console.log('');
  console.log(`SCORE: ${aprovados}/${resultados.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

function projetoGcp(): string | undefined {
  const informado = argumento('project') ?? process.env.GOOGLE_CLOUD_PROJECT;
  if (informado) return informado;
  try {
    return comando('gcloud', ['config', 'get-value', 'project']) || undefined;
  } catch {
    return undefined;
  }
}

async function main() {
  // Chaves do Langfuse e projeto GCP podem vir do .env local; nunca são impressas.
  try {
    process.loadEnvFile('.env');
  } catch {
    // sem .env: segue com o ambiente atual
  }

  const url = argumentoUrl();
  const repositorio = repositorioAtual();
  const projeto = projetoGcp();
  const servico = argumento('service') ?? 'ai-researcher-api';
  const regiao = argumento('region') ?? 'us-central1';

  // A rajada do rate limit (7) roda por último: antes dela, as perguntas reais (5 e 10)
  // receberiam 429.
  const resultados = [
    await checarEndpointPublico(url),
    checarDeployAutomatizado(repositorio),
    checarSegredosProtegidos(),
    checarTestesNoCi(repositorio),
    await checarDegradacaoGraciosa(url),
    await checarObservabilidade(),
    checarRollback(projeto, servico, regiao),
    await checarCustoPorPergunta(url),
    await checarGuardrail(url),
    checarReadme(),
    await checarShowcase(argumento('showcase') ?? process.env.CAPSTONE_SHOWCASE_URL),
    await checarRateLimiting(url, projeto),
  ];

  imprimirRelatorio(resultados);
  process.exitCode = resultados.every((r) => r.ok) ? 0 : 1;
}

main();
