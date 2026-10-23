import Fastify from 'fastify';
import { getRealGraph } from '@hero/agent';
import { mcpHttpPlugin } from './http-plugin.js';

// Ponto de entrada do servidor MCP standalone por HTTP, para clientes que não iniciam
// processo local. Escuta só em 127.0.0.1: não tem autenticação, então não sai da máquina.
const app = Fastify({ logger: true });

app.register(mcpHttpPlugin, { getGraph: getRealGraph });

app
  .listen({ port: Number(process.env.MCP_HTTP_PORT ?? 3100), host: '127.0.0.1' })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
