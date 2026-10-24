import { describe, expect, it } from 'vitest';
import { build } from './app.js';

function postarMcp(app: ReturnType<typeof build>, payload: object) {
  return app.inject({
    method: 'POST',
    url: '/api/mcp',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    payload: { jsonrpc: '2.0', id: 1, ...payload },
  });
}

describe('gateway /api/mcp', () => {
  // Decisão do plan.md §9: em produção o MCP não tem rota pública.
  it('fica desligado por padrão: sem MCP_GATEWAY=true a rota não existe', async () => {
    const response = await postarMcp(build({ mcpGateway: false }), {
      method: 'tools/list',
      params: {},
    });

    expect(response.statusCode).toBe(404);
  });

  it('CA-11: a tool perguntar responde pela API, com o grafo injetado no build', async () => {
    const app = build({
      mcpGateway: true,
      getMcpGraph: async () => ({
        invoke: async () => ({ answerText: 'Resposta citada.\n\nFontes:\n- VALE · 3T25' }),
      }),
    });

    const response = await postarMcp(app, {
      method: 'tools/call',
      params: { name: 'perguntar', arguments: { pergunta: 'Receita da Vale?' } },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().result.content[0].text).toContain('Fontes:');
  });

  it('sem grafo configurado, a tool devolve isError e a API continua de pé', async () => {
    const app = build({ checkDatabase: async () => true, mcpGateway: true });

    const response = await postarMcp(app, {
      method: 'tools/call',
      params: { name: 'perguntar', arguments: { pergunta: 'x' } },
    });
    const health = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.json().result.isError).toBe(true);
    expect(health.statusCode).toBe(200);
  });

  it('GET em /api/mcp responde 405', async () => {
    const response = await build({ mcpGateway: true }).inject({ method: 'GET', url: '/api/mcp' });

    expect(response.statusCode).toBe(405);
  });
});
