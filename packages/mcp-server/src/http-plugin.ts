import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { criarMcpServer, type McpServerOptions } from './server.js';

// Só POST existe no modo stateless: GET abriria um stream de notificações do servidor e
// DELETE encerraria uma sessão — e aqui não há sessão nenhuma.
function metodoNaoPermitido(reply: FastifyReply) {
  return reply
    .code(405)
    .header('Allow', 'POST')
    .send({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Método não permitido. Use POST.' },
      id: null,
    });
}

// Streamable HTTP stateless: cada POST ganha um servidor e um transporte novos, e nada fica
// guardado entre requisições. O que é caro (o grafo) continua compartilhado, porque vem de
// getGraph. O mesmo plugin serve o servidor standalone e o gateway /api/mcp da API.
export const mcpHttpPlugin: FastifyPluginAsync<McpServerOptions> = async (app, opcoes) => {
  app.post('/mcp', async (request, reply) => {
    const server = criarMcpServer(opcoes);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      // Resposta JSON simples em vez de SSE: a tool devolve um resultado só, no fim.
      enableJsonResponse: true,
    });

    // Quando a resposta termina (ou o cliente desiste), libera transporte e servidor.
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    // A partir daqui quem escreve a resposta é o transporte do SDK, não o Fastify.
    reply.hijack();
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  app.get('/mcp', async (_request, reply) => metodoNaoPermitido(reply));
  app.delete('/mcp', async (_request, reply) => metodoNaoPermitido(reply));
};
