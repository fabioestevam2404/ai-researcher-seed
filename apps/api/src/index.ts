import { getRealGraph } from '@hero/agent';
import { build } from './app.js';

// Único ponto da API que conhece o pacote do agente: aqui o grafo real é injetado. Chat e
// MCP recebem a mesma função memoizada — uma instância do grafo, um pool de conexões e um
// circuit breaker para as duas portas de entrada.
const app = build({ getChatGraph: getRealGraph, getMcpGraph: getRealGraph });

app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
