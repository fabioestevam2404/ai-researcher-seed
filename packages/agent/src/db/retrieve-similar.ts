import { cosineDistance, gt, sql } from 'drizzle-orm';
import type { Db } from './client.js';
import { documentos, documentosWeb } from './schema.js';
import type { DocumentoCvm, DocumentoRecuperado, DocumentoWeb } from '../documento.js';

export type BuscarDocumentosSimilares = (
  embedding: number[],
  topK: number,
) => Promise<DocumentoRecuperado[]>;

// A mesma página pode ter sido gravada por duas buscas web dentro do TTL. Trecho repetido
// não acrescenta contexto e ocupa uma vaga do top-k, então fica só a primeira ocorrência.
function semTrechosRepetidos(web: DocumentoWeb[]): DocumentoWeb[] {
  const vistos = new Set<string>();
  return web.filter((doc) => {
    const chave = `${doc.sourceUrl}\n${doc.content}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

// Junta as duas fontes e fica com os top-k mais próximos da pergunta, sem preferência de
// origem: quem decide se o contexto basta é o grade, não a ordem da busca.
export function combinarPorSimilaridade(
  cvm: DocumentoCvm[],
  web: DocumentoWeb[],
  topK: number,
): DocumentoRecuperado[] {
  return [...cvm, ...semTrechosRepetidos(web)]
    .sort((a, b) => b.similaridade - a.similaridade)
    .slice(0, topK);
}

// Busca os top-k documentos mais próximos do embedding da pergunta, no corpus da CVM e nos
// trechos da web ainda válidos. O operador é o de distância de cosseno — o mesmo do índice
// HNSW, senão o índice não é usado.
export function criarBuscarDocumentosSimilares(db: Db): BuscarDocumentosSimilares {
  return async (embedding, topK) => {
    const distanciaCvm = cosineDistance(documentos.embedding, embedding);
    const distanciaWeb = cosineDistance(documentosWeb.embedding, embedding);

    const [linhasCvm, linhasWeb] = await Promise.all([
      db
        .select({
          ticker: documentos.ticker,
          companyName: documentos.companyName,
          period: documentos.period,
          periodEnd: documentos.periodEnd,
          content: documentos.paragraph,
          sourceUrl: documentos.sourceUrl,
          similaridade: sql<number>`1 - (${distanciaCvm})`.mapWith(Number),
        })
        .from(documentos)
        .orderBy(distanciaCvm)
        .limit(topK),
      db
        .select({
          title: documentosWeb.title,
          content: documentosWeb.content,
          sourceUrl: documentosWeb.sourceUrl,
          fetchedAt: documentosWeb.fetchedAt,
          similaridade: sql<number>`1 - (${distanciaWeb})`.mapWith(Number),
        })
        .from(documentosWeb)
        // O TTL vale aqui: o que expirou simplesmente não é enxergado pela busca.
        .where(gt(documentosWeb.expiresAt, sql`now()`))
        .orderBy(distanciaWeb)
        .limit(topK),
    ]);

    return combinarPorSimilaridade(
      linhasCvm.map((linha) => ({ origem: 'cvm' as const, ...linha })),
      linhasWeb.map((linha) => ({
        origem: 'web' as const,
        ...linha,
        fetchedAt: linha.fetchedAt.toISOString(),
      })),
      topK,
    );
  };
}
