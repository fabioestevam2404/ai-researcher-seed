import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { mcpHttpPlugin } from './http-plugin.js';
import { MENSAGEM_ERRO_GENERICA, type GetGraph } from './server.js';

function montar(getGraph: GetGraph) {
  const app = Fastify();
  app.register(mcpHttpPlugin, { getGraph, logErro: () => {} });
  return app;
}

// Requisição JSON-RPC como um cliente MCP faria. O Accept com os dois tipos é exigido pela
// especificação do Streamable HTTP.
function postarMcp(app: ReturnType<typeof montar>, metodo: string, params: object) {
  return app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    payload: { jsonrpc: '2.0', id: 1, method: metodo, params },
  });
}

const grafoQueResponde: GetGraph = async () => ({
  invoke: async () => ({ answerText: 'Receita de R$ 56,7 bilhões.\n\nFontes:\n- VALE · 3T25' }),
});

describe('mcpHttpPlugin (Streamable HTTP stateless)', () => {
  it('lista a tool perguntar sem sessão prévia', async () => {
    const response = await postarMcp(montar(grafoQueResponde), 'tools/list', {});

    expect(response.statusCode).toBe(200);
    expect(response.json().result.tools.map((t: { name: string }) => t.name)).toEqual([
      'perguntar',
    ]);
    expect(response.headers['mcp-session-id']).toBeUndefined();
  });

  it('chama perguntar e devolve a resposta citada', async () => {
    const response = await postarMcp(montar(grafoQueResponde), 'tools/call', {
      name: 'perguntar',
      arguments: { pergunta: 'Receita da Vale no 3T25?' },
    });

    const { result } = response.json();
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('Fontes:');
  });

  it('erro do grafo chega ao cliente como isError genérico, com HTTP 200', async () => {
    const response = await postarMcp(
      montar(async () => {
        throw new Error('DATABASE_URL não definido.');
      }),
      'tools/call',
      { name: 'perguntar', arguments: { pergunta: 'x' } },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: MENSAGEM_ERRO_GENERICA }],
    });
    expect(response.body).not.toContain('DATABASE_URL');
  });

  it.each(['GET', 'DELETE'] as const)(
    '%s responde 405, sem sessão para abrir ou fechar',
    async (method) => {
      const response = await montar(grafoQueResponde).inject({ method, url: '/mcp' });

      expect(response.statusCode).toBe(405);
      expect(response.headers.allow).toBe('POST');
    },
  );
});
