import { describe, expect, it } from 'vitest';
import type { ChatEvent } from '@hero/contracts';
import { build } from '../app.js';
import type { GraphLike } from './chat-event.js';

// Grafo fake: devolve os passos que o LangGraph emitiria com streamMode 'updates', sem LLM
// nem Postgres.
function grafoFake(passos: Array<Record<string, unknown>>, falharNoFim = false): GraphLike {
  return {
    async stream() {
      return (async function* () {
        for (const passo of passos) yield passo;
        if (falharNoFim) throw new Error('Vertex AI fora do ar');
      })();
    },
  };
}

function lerEventos(corpo: string): ChatEvent[] {
  return corpo
    .split('\n\n')
    .filter((bloco) => bloco.startsWith('data: '))
    .map((bloco) => JSON.parse(bloco.slice('data: '.length)) as ChatEvent);
}

const passosDoGrafo = [
  {
    retrieve: {
      documents: [
        {
          origem: 'cvm',
          ticker: 'VALE',
          period: '3T25',
          sourceUrl: 'https://cvm/x.zip',
          similaridade: 0.9,
          content: 'texto completo que não deve trafegar',
        },
      ],
    },
  },
  { grade: { sufficient: false, missingAspects: ['fato relevante'], iterations: 1 } },
  { webSearch: {} },
  { answer: { answerText: 'Resposta com fontes.' } },
];

describe('POST /api/chat', () => {
  it('transmite um evento SSE por nó concluído, com os headers de streaming', async () => {
    const app = build({ getChatGraph: async () => grafoFake(passosDoGrafo) });

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { question: 'Último fato relevante da Vale?' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.headers['cache-control']).toBe('no-cache, no-transform');
    expect(response.headers.connection).toBe('keep-alive');

    const eventos = lerEventos(response.body);
    expect(eventos.map((e) => e.node)).toEqual(['retrieve', 'grade', 'webSearch', 'answer']);
    expect(eventos[0]).toMatchObject({
      documents: [
        { origem: 'cvm', rotulo: 'VALE · 3T25', sourceUrl: 'https://cvm/x.zip', similaridade: 0.9 },
      ],
    });
    expect(response.body).not.toContain('texto completo que não deve trafegar');
    expect(eventos[1]).toMatchObject({
      sufficient: false,
      missingAspects: ['fato relevante'],
      iterations: 1,
    });
    expect(eventos[3]).toMatchObject({ answer: 'Resposta com fontes.' });
    for (const evento of eventos) {
      expect(evento).toHaveProperty('durationMs');
    }
  });

  it('consulta estruturada: o grade avisa e o queryIndicators vira evento com os documentos', async () => {
    const app = build({
      getChatGraph: async () =>
        grafoFake([
          {
            grade: {
              sufficient: false,
              missingAspects: [],
              iterations: 1,
              consulta: { indicadores: ['caixa_operacional'], tickers: [], periodos: [] },
            },
          },
          {
            queryIndicators: {
              documents: [
                {
                  origem: 'cvm',
                  ticker: 'VALE',
                  period: '1T26',
                  sourceUrl: 'https://cvm/x.zip',
                  similaridade: 1,
                },
              ],
              sufficient: true,
            },
          },
          { answer: { answerText: 'ok' } },
        ]),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { question: 'Caixa das 20 empresas?' },
    });

    const [grade, consulta] = lerEventos(response.body);
    expect(grade).toMatchObject({ node: 'grade', consultaEstruturada: true });
    expect(consulta).toMatchObject({
      node: 'queryIndicators',
      documents: [{ rotulo: 'VALE · 1T26', similaridade: 1 }],
    });
  });

  it('o evento do grade traz o total de iterações, não o incremento do nó', async () => {
    const umaPassagem = { grade: { sufficient: false, missingAspects: ['x'], iterations: 1 } };
    const app = build({ getChatGraph: async () => grafoFake([umaPassagem, umaPassagem]) });

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { question: 'Último fato relevante da Vale?' },
    });

    const iteracoes = lerEventos(response.body).map((e) => (e.node === 'grade' ? e.iterations : 0));
    expect(iteracoes).toEqual([1, 2]);
  });

  it('erro no meio do stream vira evento de erro genérico, sem detalhe interno', async () => {
    const app = build({ getChatGraph: async () => grafoFake(passosDoGrafo.slice(0, 1), true) });

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { question: 'Receita da Vale?' },
    });

    const eventos = lerEventos(response.body);
    expect(eventos.map((e) => e.node)).toEqual(['retrieve', 'error']);
    expect(response.body).not.toContain('Vertex AI fora do ar');
  });

  it('a API continua de pé depois de um erro do grafo', async () => {
    const app = build({
      getChatGraph: async () => grafoFake([], true),
      checkDatabase: async () => true,
    });

    await app.inject({ method: 'POST', url: '/api/chat', payload: { question: 'x' } });
    const health = await app.inject({ method: 'GET', url: '/api/health' });

    expect(health.statusCode).toBe(200);
  });

  it('corpo inválido responde 400 em problem+json, sem abrir stream', async () => {
    const app = build({ getChatGraph: async () => grafoFake(passosDoGrafo) });

    const response = await app.inject({ method: 'POST', url: '/api/chat', payload: {} });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ status: 400, title: 'Requisição inválida' });
  });
});
