import { criarDb } from './db/client.js';
import { criarInserirDocumentosWeb } from './db/inserir-documentos-web.js';
import { criarBuscarDocumentosSimilares } from './db/retrieve-similar.js';
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
// pool de conexões e, mais adiante, um único circuit breaker.
export function getRealGraph(): Promise<RealGraph> {
  grafo ??= Promise.resolve().then(() => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL não definido.');

    const { db } = criarDb(databaseUrl);
    const embeddings = criarEmbeddings();

    return buildGraph({
      embeddings,
      buscar: criarBuscarDocumentosSimilares(db),
      gradeLlm: criarGradeLlm(),
      answerLlm: criarAnswerLlm(),
      searchProvider: criarSearchProvider(),
      buscarPagina: criarBuscarPagina(),
      inserirDocumentosWeb: criarInserirDocumentosWeb(db),
    });
  });

  // Se a construção falhar (variável faltando), a próxima chamada tenta de novo em vez de
  // ficar presa no erro para sempre.
  grafo.catch(() => {
    grafo = undefined;
  });

  return grafo;
}
