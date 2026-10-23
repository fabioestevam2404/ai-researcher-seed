import Fastify from 'fastify';
import { mcpHttpPlugin, type GetGraph as GetMcpGraph } from '@hero/mcp-server';
import healthRoute from './routes/health.js';
import chatRoute from './routes/chat.js';
import type { GetGraph as GetChatGraph } from './routes/chat-event.js';
import { checkDatabase as defaultCheckDatabase } from './db.js';
import { registrarTratamentoDeErros } from './erros.js';

// Chat e MCP recebem o grafo por portas separadas, cada uma com a interface mínima que usa
// (stream no chat, invoke no MCP). Em produção as duas apontam para o mesmo getRealGraph.
export interface BuildOptions {
  checkDatabase?: () => Promise<boolean>;
  getChatGraph?: GetChatGraph;
  getMcpGraph?: GetMcpGraph;
}

// Sem grafo injetado, chat e MCP respondem com erro em vez de derrubar a API — o health
// continua funcionando mesmo se o agente não estiver configurado.
async function grafoNaoConfigurado(): Promise<never> {
  throw new Error('Grafo do agente não configurado (não foi passado para build()).');
}

export function build({
  checkDatabase = defaultCheckDatabase,
  getChatGraph = grafoNaoConfigurado,
  getMcpGraph = grafoNaoConfigurado,
}: BuildOptions = {}) {
  const app = Fastify({ logger: true });

  // Registrado na raiz antes das rotas: vale para todas elas, inclusive as de /api.
  registrarTratamentoDeErros(app);

  app.register(
    async (api) => {
      api.register(healthRoute, { checkDatabase });
      api.register(chatRoute, { getGraph: getChatGraph });
      // Gateway MCP: o mesmo plugin do servidor standalone, aqui em /api/mcp.
      api.register(mcpHttpPlugin, {
        getGraph: getMcpGraph,
        logErro: (error) => app.log.error(error, 'Falha na tool perguntar (MCP)'),
      });
    },
    { prefix: '/api' },
  );

  return app;
}
