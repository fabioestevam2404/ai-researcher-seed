import type { FastifyPluginAsync } from 'fastify';
import { healthResponseSchema } from '@hero/contracts';

export interface HealthRouteOptions {
  checkDatabase: () => Promise<boolean>;
}

const healthRoute: FastifyPluginAsync<HealthRouteOptions> = async (app, { checkDatabase }) => {
  app.get('/health', async () => {
    const databaseOk = await checkDatabase();

    return healthResponseSchema.parse({
      status: databaseOk ? 'ok' : 'degraded',
      database: databaseOk ? 'ok' : 'error',
    });
  });
};

export default healthRoute;
