import { describe, expect, it } from 'vitest';
import { problemSchema } from '@hero/contracts';
import { build } from './app.js';
import { LIMITES_PADRAO, lerLimites, type Limites } from './limites.js';
import { OrcamentoDiario } from './orcamento.js';
import type { GraphLike } from './routes/chat-event.js';

// Grafo que responde na hora, sem LLM: o que importa aqui é a porta, não a resposta.
const grafoRapido: GraphLike = {
  async stream() {
    return (async function* () {
      yield { answer: { answerText: 'ok' } };
    })();
  },
};

function montar(limites: Partial<Limites>, orcamento?: OrcamentoDiario) {
  return build({
    checkDatabase: async () => true,
    getChatGraph: async () => grafoRapido,
    limites: { ...LIMITES_PADRAO, ...limites },
    orcamento,
  });
}

function perguntar(app: ReturnType<typeof build>) {
  return app.inject({
    method: 'POST',
    url: '/api/chat',
    payload: { question: 'Receita da Vale?' },
  });
}

describe('lerLimites', () => {
  it('usa os padrões conservadores quando as variáveis não existem', () => {
    expect(lerLimites({})).toEqual({
      rateLimitMax: 10,
      rateLimitJanela: '1 minute',
      orcamentoDiarioTokens: 300_000,
    });
  });

  it('lê do ambiente e recusa valor que não é inteiro positivo', () => {
    expect(lerLimites({ RATE_LIMIT_MAX: '30', DAILY_TOKEN_BUDGET: '1000000' })).toMatchObject({
      rateLimitMax: 30,
      orcamentoDiarioTokens: 1_000_000,
    });
    expect(() => lerLimites({ RATE_LIMIT_MAX: 'dez' })).toThrow('RATE_LIMIT_MAX');
  });
});

describe('CA-10: rate limit', () => {
  it('passado o limite, responde 429 em problem+json antes de qualquer byte SSE', async () => {
    const app = montar({ rateLimitMax: 2 });

    expect((await perguntar(app)).statusCode).toBe(200);
    expect((await perguntar(app)).statusCode).toBe(200);
    const bloqueada = await perguntar(app);

    expect(bloqueada.statusCode).toBe(429);
    expect(bloqueada.headers['content-type']).toContain('application/problem+json');
    expect(bloqueada.headers['retry-after']).toBeDefined();
    expect(problemSchema.parse(bloqueada.json())).toMatchObject({ title: 'Muitas requisições' });
    expect(bloqueada.body).not.toContain('data:');
  });

  it('health fica fora do limite', async () => {
    const app = montar({ rateLimitMax: 1 });
    await perguntar(app);

    for (let i = 0; i < 3; i++) {
      expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    }
  });
});

describe('CA-10: orçamento diário', () => {
  it('esgotado, responde 429 em problem+json antes do stream, com Retry-After até a meia-noite UTC', async () => {
    // Meio-dia UTC, teto de 1.000 tokens já gasto.
    const orcamento = new OrcamentoDiario(1_000, () => new Date('2026-10-24T12:00:00Z'));
    orcamento.registrar(1_000);

    const resposta = await perguntar(montar({}, orcamento));

    expect(resposta.statusCode).toBe(429);
    expect(resposta.body).not.toContain('data:');
    expect(resposta.headers['content-type']).toContain('application/problem+json');
    expect(resposta.headers['retry-after']).toBe(String(12 * 60 * 60));
    expect(problemSchema.parse(resposta.json())).toMatchObject({
      title: 'Orçamento diário esgotado',
    });
  });
});

describe('OrcamentoDiario', () => {
  it('zera no dia seguinte (UTC)', () => {
    let agora = new Date('2026-10-24T23:59:00Z');
    const orcamento = new OrcamentoDiario(100, () => agora);
    orcamento.registrar(150);
    expect(() => orcamento.garantirDisponivel()).toThrow();

    agora = new Date('2026-10-25T00:00:01Z');

    expect(() => orcamento.garantirDisponivel()).not.toThrow();
    expect(orcamento.usadosHoje).toBe(0);
  });
});
