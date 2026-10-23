import { cosineDistance, sql } from 'drizzle-orm';
import type { Db } from './client.js';
import { documentos } from './schema.js';
import type { DocumentoRecuperado } from '../documento.js';

export type BuscarDocumentosSimilares = (
  embedding: number[],
  topK: number,
) => Promise<DocumentoRecuperado[]>;

// Busca os top-k documentos mais próximos do embedding da pergunta. O operador é o de
// distância de cosseno — o mesmo do índice HNSW, senão o índice não é usado.
export function criarBuscarDocumentosSimilares(db: Db): BuscarDocumentosSimilares {
  return async (embedding, topK) => {
    const distancia = cosineDistance(documentos.embedding, embedding);

    const linhas = await db
      .select({
        ticker: documentos.ticker,
        companyName: documentos.companyName,
        period: documentos.period,
        periodEnd: documentos.periodEnd,
        content: documentos.paragraph,
        sourceUrl: documentos.sourceUrl,
        similaridade: sql<number>`1 - (${distancia})`.mapWith(Number),
      })
      .from(documentos)
      .orderBy(distancia)
      .limit(topK);

    return linhas.map((linha) => ({ origem: 'cvm' as const, ...linha }));
  };
}
