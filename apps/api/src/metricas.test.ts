import { describe, expect, it } from 'vitest';
import { build } from './app.js';
import { LIMITES_PADRAO } from './limites.js';
import { custoUsd, type UsoDeTokens } from './metricas.js';
import type { GraphLike } from './routes/chat-event.js';

describe('custoUsd', () => {
  it('multiplica tokens pelo preço por milhão de cada modelo', () => {
    expect(
      custoUsd({ modelo: 'gemini-3.5-flash-lite', tokensEntrada: 1_000_000, tokensSaida: 0 }),
    ).toBeCloseTo(0.3);
    expect(
      custoUsd({ modelo: 'gemini-3.6-flash', tokensEntrada: 0, tokensSaida: 1_000_000 }),
    ).toBeCloseTo(7.5);
  });

  it('modelo fora da tabela não inventa preço: custo zero (os tokens ainda contam)', () => {
    expect(custoUsd({ modelo: 'desconhecido', tokensEntrada: 500, tokensSaida: 500 })).toBe(0);
  });
});

// Simula o que acontece de verdade: o grafo recebe as callbacks no stream() e, durante a
// execução, o contador de tokens do agente chama aoUsar. Aqui o "contador" é falso e o grafo
// falso dispara o uso de uma chamada de grade e uma de answer.
function montar(orcamentoDiarioTokens: number) {
  let aoUsarCapturado: ((uso: UsoDeTokens) => void) | undefined;
  const grafo: GraphLike = {
    async stream() {
      aoUsarCapturado?.({ modelo: 'gemini-3.5-flash-lite', tokensEntrada: 1200, tokensSaida: 20 });
      aoUsarCapturado?.({ modelo: 'gemini-3.6-flash', tokensEntrada: 900, tokensSaida: 80 });
      return (async function* () {
        yield { answer: { answerText: 'ok' } };
      })();
    },
  };

  return build({
    checkDatabase: async () => true,
    getChatGraph: async () => grafo,
    limites: { ...LIMITES_PADRAO, orcamentoDiarioTokens },
    criarContadorDeTokens: (aoUsar) => {
      aoUsarCapturado = aoUsar;
      return {};
    },
  });
}

const perguntar = (app: ReturnType<typeof build>) =>
  app.inject({ method: 'POST', url: '/api/chat', payload: { question: 'Receita da Vale?' } });

describe('GET /api/metrics', () => {
  it('expõe tokens e custo por modelo no formato do Prometheus', async () => {
    const app = montar(300_000);
    await perguntar(app);

    const resposta = await app.inject({ method: 'GET', url: '/api/metrics' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-type']).toContain('text/plain');
    expect(resposta.body).toContain(
      'llm_tokens_total{modelo="gemini-3.5-flash-lite",tipo="entrada"} 1200',
    );
    expect(resposta.body).toContain('llm_tokens_total{modelo="gemini-3.6-flash",tipo="saida"} 80');
    expect(resposta.body).toMatch(/llm_cost_usd_total\{modelo="gemini-3.6-flash"\} 0\.001/);
    // Denominador do custo por pergunta (item 9 do capstone:check).
    expect(resposta.body).toContain('chat_perguntas_total 1');
  });

  it('pergunta recusada (corpo inválido) não conta como pergunta', async () => {
    const app = montar(300_000);
    await app.inject({ method: 'POST', url: '/api/chat', payload: {} });

    const resposta = await app.inject({ method: 'GET', url: '/api/metrics' });

    expect(resposta.body).toContain('chat_perguntas_total 0');
  });

  it('os mesmos tokens alimentam o orçamento: estourado, a próxima pergunta recebe 429', async () => {
    // Uma pergunta gasta 2.200 tokens; o teto é 2.000.
    const app = montar(2_000);

    expect((await perguntar(app)).statusCode).toBe(200);
    expect((await perguntar(app)).statusCode).toBe(429);
  });

  it('fica fora do rate limit', async () => {
    const app = build({ limites: { ...LIMITES_PADRAO, rateLimitMax: 1 } });

    for (let i = 0; i < 3; i++) {
      expect((await app.inject({ method: 'GET', url: '/api/metrics' })).statusCode).toBe(200);
    }
  });
});
