import Fastify from 'fastify';
import healthRoute from './routes/health.js';
import chatRoute from './routes/chat.js';
import type { GetGraph } from './routes/chat-event.js';
import { checkDatabase as defaultCheckDatabase } from './db.js';
import { registrarTratamentoDeErros } from './erros.js';

export interface BuildOptions {
  checkDatabase?: () => Promise<boolean>;
  getGraph?: GetGraph;
}

// Sem grafo injetado, o /chat responde com evento de erro em vez de derrubar a API — o
// health continua funcionando mesmo se o agente não estiver configurado.
const grafoNaoConfigurado: GetGraph = async () => {
  throw new Error('Grafo do agente não configurado (getGraph não foi passado para build()).');
};

export function build({
  checkDatabase = defaultCheckDatabase,
  getGraph = grafoNaoConfigurado,
}: BuildOptions = {}) {
  const app = Fastify({ logger: true });

  // Registrado na raiz antes das rotas: vale para todas elas, inclusive as de /api.
  registrarTratamentoDeErros(app);

  app.register(
    async (api) => {
      api.register(healthRoute, { checkDatabase });
      api.register(chatRoute, { getGraph });
    },
    { prefix: '/api' },
  );

  return app;
}
