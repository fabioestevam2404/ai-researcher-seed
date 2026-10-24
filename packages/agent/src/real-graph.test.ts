import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRealGraph } from './real-graph.js';

// Construir o grafo real não abre conexão nem chama o Vertex: o pool do Postgres só conecta na
// primeira consulta, e os clientes do LangChain só autenticam na primeira chamada. Por isso
// dá para testar a memoização sem rede.
const ambienteCompleto = {
  DATABASE_URL: 'postgresql://teste:teste@127.0.0.1:1/teste',
  // O ChatVertexAI confere o formato do nome no construtor: precisa parecer um Gemini.
  MODEL_GRADE: 'gemini-3.5-flash-lite',
  MODEL_ANSWER: 'gemini-3.6-flash',
  MODEL_EMBEDDING: 'gemini-embedding-001',
  GOOGLE_CLOUD_PROJECT: 'projeto-teste',
  SERPER_API_KEY: 'chave-falsa',
  DEMO: 'false',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getRealGraph', () => {
  // A ordem dos dois testes importa: a memoização é por processo.
  it('se a construção falha, não memoiza o erro: a próxima chamada tenta de novo', async () => {
    vi.stubEnv('DATABASE_URL', '');
    await expect(getRealGraph()).rejects.toThrow('DATABASE_URL não definido');

    for (const [nome, valor] of Object.entries(ambienteCompleto)) vi.stubEnv(nome, valor);
    await expect(getRealGraph()).resolves.toBeDefined();
  });

  it('chat e MCP recebem a mesma instância do grafo (um pool, um circuit breaker)', async () => {
    for (const [nome, valor] of Object.entries(ambienteCompleto)) vi.stubEnv(nome, valor);

    const [doChat, doMcp] = await Promise.all([getRealGraph(), getRealGraph()]);

    expect(doMcp).toBe(doChat);
  });
});
