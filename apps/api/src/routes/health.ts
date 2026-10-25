import type { FastifyPluginAsync } from 'fastify';
import { healthResponseSchema } from '@hero/contracts';

export interface HealthRouteOptions {
  checkDatabase: () => Promise<boolean>;
}

// O Cloud Run define K_REVISION em cada revisão. O gate do canary lê este cabeçalho para saber
// qual revisão atendeu cada requisição — sem mudar o corpo (o contrato) do health.
const REVISAO = process.env.K_REVISION ?? 'local';

const healthRoute: FastifyPluginAsync<HealthRouteOptions> = async (app, { checkDatabase }) => {
  app.get('/health', async (_request, reply) => {
    reply.header('x-revisao', REVISAO);
    const databaseOk = await checkDatabase();

    return healthResponseSchema.parse({
      status: databaseOk ? 'ok' : 'degraded',
      database: databaseOk ? 'ok' : 'error',
    });
  });
};

export default healthRoute;
