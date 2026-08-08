import type { FastifyPluginAsync } from 'fastify';
import { healthResponseSchema } from '@hero/contracts';

const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    return healthResponseSchema.parse({ status: 'ok', database: 'ok' });
  });
};

export default healthRoute;
