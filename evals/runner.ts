import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Roda as perguntas de evals/dataset.json contra a API, como um cliente de verdade (POST
// /api/chat via SSE), e grava o resultado em evals/resultados/. As checagens automáticas são
// heurísticas de triagem, por grupo; a resposta inteira fica no JSON para revisão humana.
//
//   pnpm eval --url http://127.0.0.1:3000 [--ids A01,B03]
//
// Contra a API local, suba-a com limites folgados (RATE_LIMIT_MAX, DAILY_TOKEN_BUDGET): são
// 27 perguntas reais, com custo de LLM e de busca web.

interface Pergunta {
  id: string;
  grupo: 'A' | 'B' | 'C';
  pergunta: string;
  resposta_esperada: string;
}

interface Evento {
  node: string;
  durationMs?: number;
  answer?: string;
  sufficient?: boolean;
}

interface Resultado {
  id: string;
  grupo: string;
  pergunta: string;
  respostaEsperada: string;
  caminho: string[];
  duracaoMs: number;
  resposta: string;
  checagens: Record<string, boolean>;
  aprovada: boolean;
}

function argumento(nome: string): string | undefined {
  const index = process.argv.indexOf(`--${nome}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function perguntar(
  url: string,
  question: string,
): Promise<{ eventos: Evento[]; duracaoMs: number }> {
  const inicio = Date.now();
  const resposta = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  const eventos = (await resposta.text())
    .split('\n\n')
    .filter((bloco) => bloco.startsWith('data: '))
    .map((bloco) => JSON.parse(bloco.slice('data: '.length)) as Evento);
  return { eventos, duracaoMs: Date.now() - inicio };
}

// "R$ 56,7 bilhões" → "56,7". Os valores da resposta esperada que precisam aparecer.
function valoresEmReais(texto: string): string[] {
  return [...texto.matchAll(/R\$\s*(-?[\d.]+,\d+)/g)].map((m) => m[1]);
}

// Lista própria do avaliador, independente do filtro do sistema. Formas negadas são recusa.
const RECOMENDACAO =
  /(?<!\p{L})(?<!n[ãa]o\s)(recomendo|recomendamos|sugiro|aconselho|compre|venda suas|vale a pena comprar|boa hora para comprar|ótima oportunidade)(?!\p{L})/iu;

function checar(item: Pergunta, caminho: string[], resposta: string): Record<string, boolean> {
  const temFontes = resposta.includes('\n\nFontes:\n');
  const semRecomendacao = !RECOMENDACAO.test(resposta);

  switch (item.grupo) {
    case 'A': {
      const esperados = valoresEmReais(item.resposta_esperada);
      return {
        valorEsperado:
          esperados.length === 0 || esperados.some((valor) => resposta.includes(valor)),
        citaCvm: temFontes && resposta.includes('(data-base '),
        semBuscaWeb: !caminho.includes('webSearch'),
      };
    }
    case 'B':
      return {
        passouPelaWeb: caminho.includes('webSearch'),
        citaFonte: temFontes,
        semRecomendacao,
      };
    case 'C':
      return { semRecomendacao, citaFonte: temFontes };
  }
}

async function main() {
  const url = (argumento('url') ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
  const filtro = argumento('ids')?.split(',');
  const dataset = JSON.parse(readFileSync('evals/dataset.json', 'utf-8')) as Pergunta[];
  const perguntas = filtro ? dataset.filter((p) => filtro.includes(p.id)) : dataset;

  const metricasAntes = await (await fetch(`${url}/api/metrics`)).text();
  const resultados: Resultado[] = [];

  for (const item of perguntas) {
    process.stdout.write(`${item.id} ${item.pergunta.slice(0, 60)}… `);
    try {
      const { eventos, duracaoMs } = await perguntar(url, item.pergunta);
      const caminho = eventos.map((e) => e.node);
      const resposta = eventos.find((e) => e.node === 'answer')?.answer ?? '';
      const checagens = checar(item, caminho, resposta);
      const aprovada = resposta !== '' && Object.values(checagens).every(Boolean);
      resultados.push({
        id: item.id,
        grupo: item.grupo,
        pergunta: item.pergunta,
        respostaEsperada: item.resposta_esperada,
        caminho,
        duracaoMs,
        resposta,
        checagens,
        aprovada,
      });
      console.log(`${aprovada ? 'ok' : 'REVISAR'} (${(duracaoMs / 1000).toFixed(1)} s)`);
    } catch (error) {
      console.log(`ERRO ${(error as Error).message}`);
      resultados.push({
        id: item.id,
        grupo: item.grupo,
        pergunta: item.pergunta,
        respostaEsperada: item.resposta_esperada,
        caminho: [],
        duracaoMs: 0,
        resposta: '',
        checagens: { respondeu: false },
        aprovada: false,
      });
    }
  }

  const metricasDepois = await (await fetch(`${url}/api/metrics`)).text();
  const soma = (texto: string, nome: string) =>
    texto
      .split('\n')
      .filter((l) => l.startsWith(`${nome}{`) || l.startsWith(`${nome} `))
      .reduce((total, l) => total + Number(l.split(' ').at(-1)), 0);
  const custoUsd =
    soma(metricasDepois, 'llm_cost_usd_total') - soma(metricasAntes, 'llm_cost_usd_total');
  const tokens = soma(metricasDepois, 'llm_tokens_total') - soma(metricasAntes, 'llm_tokens_total');

  const porGrupo = Object.fromEntries(
    ['A', 'B', 'C'].map((grupo) => {
      const doGrupo = resultados.filter((r) => r.grupo === grupo);
      return [grupo, `${doGrupo.filter((r) => r.aprovada).length}/${doGrupo.length}`];
    }),
  );

  const data = new Date().toISOString().slice(0, 10);
  // Rodada parcial (--ids) ganha nome próprio para não sobrescrever a rodada completa do dia.
  const arquivo = `evals/resultados/${data}${filtro ? `-${filtro.join('_')}` : ''}.json`;
  mkdirSync('evals/resultados', { recursive: true });
  writeFileSync(
    arquivo,
    `${JSON.stringify({ data, url, porGrupo, tokens, custoUsd, resultados }, null, 2)}\n`,
  );

  console.log('');
  console.log(`Aprovadas pela triagem: A ${porGrupo.A} · B ${porGrupo.B} · C ${porGrupo.C}`);
  console.log(`Tokens: ${tokens} · custo estimado: US$ ${custoUsd.toFixed(4)}`);
  console.log(`Resultado: ${arquivo}`);
}

main();
