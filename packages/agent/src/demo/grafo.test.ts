import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRealGraph } from '../real-graph.js';
import { garantirForaDoModoDemo } from '../seed/seed.js';
import { RESPOSTA_DEMO } from './grafo.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('modo demo do grafo inteiro', () => {
  // Sem DATABASE_URL, sem MODEL_*, sem SERPER_API_KEY: se alguma fábrica tentasse o serviço
  // real, a construção falharia por variável faltando.
  it('responde sem banco, sem Vertex e sem rede, pelo caminho retrieve → grade → answer', async () => {
    for (const nome of ['DATABASE_URL', 'MODEL_GRADE', 'MODEL_ANSWER', 'MODEL_EMBEDDING']) {
      vi.stubEnv(nome, '');
    }
    vi.stubEnv('DEMO', 'true');

    const visitados: string[] = [];
    let answerText = '';
    const graph = await getRealGraph();
    for await (const passo of await graph.stream(
      { question: 'Devo comprar Petrobras?' },
      { streamMode: 'updates' },
    )) {
      visitados.push(...Object.keys(passo));
      if ('answer' in passo) answerText = passo.answer.answerText;
    }

    expect(visitados).toEqual(['retrieve', 'grade', 'answer']);
    // O que o CA-12 (E2E) confere na tela: valor, data-base e link do ZIP da CVM.
    expect(answerText.startsWith(RESPOSTA_DEMO)).toBe(true);
    expect(answerText).toContain('R$ 56,7 bilhões');
    expect(answerText).toContain(
      'VALE · 3T25 (data-base 2025-09-30) — https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip',
    );
  });

  it('o seed se recusa a rodar em modo demo (é a primeira coisa que o run.ts confere)', () => {
    expect(() => garantirForaDoModoDemo({ DEMO: 'true' })).toThrow(
      'O seed nunca roda em modo demo',
    );
    expect(() => garantirForaDoModoDemo({})).not.toThrow();
  });
});
