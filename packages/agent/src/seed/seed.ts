import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import type { DocumentoCorpus } from './documento-corpus.js';

// Lotes de 10: uma chamada ao Vertex AI por lote, em vez de uma por documento.
export const TAMANHO_LOTE = 10;

export interface DocumentoComEmbedding extends DocumentoCorpus {
  embedding: number[];
}

export interface SeedDeps {
  embeddings: EmbeddingsInterface;
  gravar: (lote: DocumentoComEmbedding[]) => Promise<void>;
}

// Gera o embedding do parágrafo de cada documento e grava lote a lote. As dependências
// entram por parâmetro: no teste, embeddings e gravação são fakes, sem rede nem banco.
export async function seedDocumentos(
  documentos: DocumentoCorpus[],
  { embeddings, gravar }: SeedDeps,
): Promise<number> {
  let gravados = 0;

  for (let inicio = 0; inicio < documentos.length; inicio += TAMANHO_LOTE) {
    const lote = documentos.slice(inicio, inicio + TAMANHO_LOTE);
    const vetores = await embeddings.embedDocuments(lote.map((doc) => doc.paragraph));

    if (vetores.length !== lote.length) {
      throw new Error(
        `Embeddings devolveu ${vetores.length} vetores para ${lote.length} documentos.`,
      );
    }

    await gravar(lote.map((doc, i) => ({ ...doc, embedding: vetores[i] })));
    gravados += lote.length;
  }

  return gravados;
}
