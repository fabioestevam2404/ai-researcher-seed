import { execFileSync } from 'node:child_process';

interface CheckResult {
  numero: number;
  titulo: string;
  ok: boolean;
  detalhe: string;
}

function argumentoUrl(): string {
  const index = process.argv.indexOf('--url');
  const url = index !== -1 ? process.argv[index + 1] : undefined;
  if (!url) {
    console.error('Uso: pnpm capstone:check --url https://meu-projeto.run.app');
    process.exit(1);
  }
  return url;
}

async function checarEndpointPublico(url: string): Promise<CheckResult> {
  const alvo = `${url.replace(/\/$/, '')}/api/health`;
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
      detalhe: `sem resposta (${(error as Error).message})`,
    };
  }
}

function repositorioAtual(): { owner: string; repo: string } | undefined {
  try {
    const remoto = execFileSync('git', ['remote', 'get-url', 'origin'], {
      encoding: 'utf-8',
    }).trim();
    const match = /github\.com[/:]([^/]+)\/([^/.]+)(\.git)?$/.exec(remoto);
    if (!match) return undefined;
    return { owner: match[1], repo: match[2] };
  } catch {
    return undefined;
  }
}

function checarDeployAutomatizado(): CheckResult {
  const repositorio = repositorioAtual();
  if (!repositorio) {
    return {
      numero: 2,
      titulo: 'Deploy automatizado',
      ok: false,
      detalhe: 'não foi possível identificar o repositório (remote "origin")',
    };
  }

  try {
    const saida = execFileSync(
      'gh',
      [
        'api',
        `repos/${repositorio.owner}/${repositorio.repo}/actions/workflows/deploy.yml/runs`,
        '--jq',
        '.workflow_runs[0] | {status, conclusion, created_at}',
      ],
      { encoding: 'utf-8' },
    ).trim();

    if (!saida) {
      return {
        numero: 2,
        titulo: 'Deploy automatizado',
        ok: false,
        detalhe: 'nenhuma execução do workflow deploy.yml encontrada',
      };
    }

    const run = JSON.parse(saida) as {
      status: string;
      conclusion: string | null;
      created_at: string;
    };
    const ok = run.status === 'completed' && run.conclusion === 'success';
    const horasAtras = Math.round(
      (Date.now() - new Date(run.created_at).getTime()) / (1000 * 60 * 60),
    );

    return {
      numero: 2,
      titulo: 'Deploy automatizado',
      ok,
      detalhe: ok
        ? `há ${horasAtras}h · GitHub Actions`
        : `última execução: ${run.status}/${run.conclusion ?? 'em andamento'}`,
    };
  } catch (error) {
    return {
      numero: 2,
      titulo: 'Deploy automatizado',
      ok: false,
      detalhe: `gh api falhou (${(error as Error).message})`,
    };
  }
}

const PADROES_CREDENCIAL: RegExp[] = [
  /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /"private_key":\s*"/,
];

function checarSegredosProtegidos(): CheckResult {
  const arquivos = execFileSync('git', ['ls-files'], { encoding: 'utf-8' })
    .trim()
    .split('\n')
    .filter(Boolean);

  const suspeitos: string[] = [];

  for (const arquivo of arquivos) {
    if (/(^|\/)\.env(\..*)?$/.test(arquivo) && !arquivo.endsWith('.env.example')) {
      suspeitos.push(arquivo);
      continue;
    }

    let conteudo: string;
    try {
      conteudo = execFileSync('git', ['show', `HEAD:${arquivo}`], { encoding: 'utf-8' });
    } catch {
      continue;
    }

    if (PADROES_CREDENCIAL.some((padrao) => padrao.test(conteudo))) {
      suspeitos.push(arquivo);
    }
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

function usuarioGithub(): string {
  try {
    return execFileSync('gh', ['api', 'user', '--jq', '.login'], { encoding: 'utf-8' }).trim();
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

  for (const resultado of resultados) {
    const emoji = resultado.ok ? '✅' : '❌';
    console.log(
      `${emoji}  ${resultado.numero}. ${resultado.titulo.padEnd(20)} ${resultado.detalhe}`,
    );
  }

  const aprovados = resultados.filter((r) => r.ok).length;
  console.log('');
  console.log(`SCORE: ${aprovados}/${resultados.length} (itens 4–12 chegam nos próximos blocos)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

async function main() {
  const url = argumentoUrl();

  const resultados = [
    await checarEndpointPublico(url),
    checarDeployAutomatizado(),
    checarSegredosProtegidos(),
  ];

  imprimirRelatorio(resultados);

  process.exitCode = resultados.every((r) => r.ok) ? 0 : 1;
}

main();
