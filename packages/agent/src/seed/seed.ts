import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { modoDemo } from '../demo/modo-demo.js';
import type { DocumentoCorpus } from './documento-corpus.js';

// No modo demo os embeddings são vetores de zeros: gravá-los sobrescreveria o índice real
// com vetores inúteis, e toda busca passaria a devolver qualquer coisa.
export function garantirForaDoModoDemo(env: NodeJS.ProcessEnv = process.env): void {
  if (modoDemo(env)) {
    throw new Error('O seed nunca roda em modo demo. Remova DEMO=true do ambiente.');
  }
}

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
