import Fastify from 'fastify';
import healthRoute from './routes/health.js';
import { checkDatabase as defaultCheckDatabase } from './db.js';

export interface BuildOptions {
  checkDatabase?: () => Promise<boolean>;
}

export function build({ checkDatabase = defaultCheckDatabase }: BuildOptions = {}) {
  const app = Fastify({ logger: true });

  app.register(
    async (api) => {
      api.register(healthRoute, { checkDatabase });
    },
    { prefix: '/api' },
  );

  return app;
}
