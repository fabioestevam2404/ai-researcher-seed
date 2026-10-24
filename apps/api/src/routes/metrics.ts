import type { FastifyPluginAsync } from 'fastify';

// Só o que a rota usa do Registry do prom-client: o tipo de conteúdo e o texto das métricas.
export interface RegistryLike {
  contentType: string;
  metrics(): Promise<string>;
}

export interface MetricsRouteOptions {
  registry: RegistryLike;
}

// Formato texto do Prometheus, para o scrape do Grafana Cloud. Fora do rate limit (app.ts).
const metricsRoute: FastifyPluginAsync<MetricsRouteOptions> = async (app, { registry }) => {
  app.get('/metrics', async (_request, reply) =>
    reply.type(registry.contentType).send(await registry.metrics()),
  );
};

export default metricsRoute;
