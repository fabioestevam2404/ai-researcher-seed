import { describe, expect, it } from 'vitest';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import type { DocumentoRecuperado } from '../documento.js';
import { makeRetrieveNode, TOP_K } from './retrieve.js';

const documentoVale: DocumentoRecuperado = {
  origem: 'cvm',
  ticker: 'VALE',
  companyName: 'Vale S.A.',
  period: '3T25',
  periodEnd: '2025-09-30',
  content: 'No 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões.',
  sourceUrl: 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip',
  similaridade: 0.89,
};

describe('makeRetrieveNode', () => {
  it('gera o embedding da pergunta e busca os top-k documentos com ele', async () => {
    const perguntasEmbedadas: string[] = [];
    const embeddings: EmbeddingsInterface = {
      embedQuery: async (texto) => {
        perguntasEmbedadas.push(texto);
        return [0.1, 0.2, 0.3];
      },
      embedDocuments: async () => [],
    };
    const buscas: Array<{ embedding: number[]; topK: number }> = [];

    const retrieve = makeRetrieveNode({
      embeddings,
      buscar: async (embedding, topK) => {
        buscas.push({ embedding, topK });
        return [documentoVale];
      },
    });

    const resultado = await retrieve({ question: 'Receita da Vale no 3T25?' });

    expect(perguntasEmbedadas).toEqual(['Receita da Vale no 3T25?']);
    expect(buscas).toEqual([{ embedding: [0.1, 0.2, 0.3], topK: TOP_K }]);
    expect(TOP_K).toBe(5);
    expect(resultado.documents).toEqual([documentoVale]);
  });

  it('devolve lista vazia quando a busca não encontra nada', async () => {
    const retrieve = makeRetrieveNode({
      embeddings: { embedQuery: async () => [0], embedDocuments: async () => [] },
      buscar: async () => [],
    });

    expect(await retrieve({ question: 'qualquer coisa' })).toEqual({ documents: [] });
  });
});
