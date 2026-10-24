import {
  criarCallbacksLangfuse,
  criarContadorDeTokens,
  getRealGraph,
  iniciarTelemetria,
} from '@hero/agent';
import { build } from './app.js';

// Primeira coisa do processo: o OpenTelemetry precisa estar ligado antes de qualquer chamada de
// LLM para os traces chegarem ao Langfuse. Sem chaves, não faz nada.
iniciarTelemetria();

// Único ponto da API que conhece o pacote do agente: aqui o grafo real, o contador de tokens e
// o Langfuse são injetados. Chat e MCP recebem a mesma função memoizada — uma instância do
// grafo, um pool de conexões e um circuit breaker para as duas portas de entrada.
const app = build({
  getChatGraph: getRealGraph,
  getMcpGraph: getRealGraph,
  criarContadorDeTokens,
  criarCallbacksDeObservabilidade: criarCallbacksLangfuse,
});

app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
