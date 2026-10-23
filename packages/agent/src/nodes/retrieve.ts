import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import type { BuscarDocumentosSimilares } from '../db/retrieve-similar.js';
import type { DocumentoRecuperado } from '../documento.js';

export const TOP_K = 5;

export interface RetrieveDeps {
  embeddings: EmbeddingsInterface;
  buscar: BuscarDocumentosSimilares;
}

// Factory: o nó não importa cliente global. Recebe o cliente de embeddings e a função de
// busca por parâmetro — no teste, os dois são fakes, sem Vertex AI nem Postgres.
export function makeRetrieveNode({ embeddings, buscar }: RetrieveDeps) {
  return async (state: { question: string }): Promise<{ documents: DocumentoRecuperado[] }> => {
    const embedding = await embeddings.embedQuery(state.question);
    const documents = await buscar(embedding, TOP_K);
    return { documents };
  };
}
