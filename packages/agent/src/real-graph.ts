import { criarPersistencia } from './db/persistencia.js';
import { buildGraph } from './graph.js';
import { criarAnswerLlm, criarGradeLlm } from './llm/chat.js';
import { criarEmbeddings } from './llm/embeddings.js';
import { criarSearchProvider } from './search/index.js';
import { criarBuscarPagina } from './web/index.js';

export type RealGraph = ReturnType<typeof buildGraph>;

let grafo: Promise<RealGraph> | undefined;

// O grafo de verdade (Postgres + Vertex AI + Serper), memoizado por processo: construído
// na primeira chamada, nunca na inicialização. Assim a API sobe mesmo sem as variáveis do
// agente, e todas as portas de entrada (chat, MCP) usam a mesma instância — um único
// pool de conexões e um único circuit breaker. Cada fábrica abaixo decide sozinha se está
// em modo demo; este arquivo não sabe que o demo existe.
export function getRealGraph(): Promise<RealGraph> {
  grafo ??= Promise.resolve().then(() =>
    buildGraph({
      ...criarPersistencia(),
      embeddings: criarEmbeddings(),
      gradeLlm: criarGradeLlm(),
      answerLlm: criarAnswerLlm(),
      searchProvider: criarSearchProvider(),
      buscarPagina: criarBuscarPagina(),
    }),
  );

  // Se a construção falhar (variável faltando), a próxima chamada tenta de novo em vez de
  // ficar presa no erro para sempre.
  grafo.catch(() => {
    grafo = undefined;
  });

  return grafo;
}
