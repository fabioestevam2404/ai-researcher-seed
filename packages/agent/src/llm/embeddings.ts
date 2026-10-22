import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { VertexAIEmbeddings } from '@langchain/google-vertexai';
import { EMBEDDING_DIMENSIONS } from '../db/schema.js';

// Cliente de embeddings real (Vertex AI). Fica numa função própria porque o modo DEMO
// vai trocá-lo por um fake sem rede — quem consome recebe só a interface do LangChain.
export function criarEmbeddings(): EmbeddingsInterface {
  const model = process.env.MODEL_EMBEDDING;
  if (!model) {
    throw new Error('MODEL_EMBEDDING não definido. Configure no .env (ex.: gemini-embedding-001).');
  }

  return new VertexAIEmbeddings({
    model,
    // Sem isto o modelo devolve 3.072 dimensões e estoura a coluna vector(768).
    dimensions: EMBEDDING_DIMENSIONS,
    location: process.env.GOOGLE_CLOUD_LOCATION ?? 'global',
  });
}
