import Fastify from 'fastify';
import healthRoute from './routes/health.js';

export function build() {
  const app = Fastify({ logger: true });

  app.register(
    async (api) => {
      api.register(healthRoute);
    },
    { prefix: '/api' },
  );

  return app;
}
