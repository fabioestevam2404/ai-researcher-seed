import { describe, expect, it } from 'vitest';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { documentoCorpusSchema, type DocumentoCorpus } from './documento-corpus.js';
import { seedDocumentos, TAMANHO_LOTE, type DocumentoComEmbedding } from './seed.js';

function documento(i: number): DocumentoCorpus {
  return {
    ticker: `T${i}`,
    companyName: `Empresa ${i}`,
    setor: 'Teste',
    period: '3T25',
    periodEnd: '2025-09-30',
    receitaLiquida: 1_000_000,
    lucroBruto: null,
    lucroLiquido: 100_000,
    ativoTotal: 5_000_000,
    patrimonioLiquido: 2_000_000,
    caixaOperacional: 300_000,
    sourceUrl: 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip',
    fetchedAt: '2026-08-08T02:19:40.760Z',
    paragraph: `parágrafo ${i}`,
  };
}

// Embeddings fake: devolve um vetor por texto e registra o tamanho de cada chamada.
function fakeEmbeddings() {
  const chamadas: number[] = [];
  const embeddings: EmbeddingsInterface = {
    embedDocuments: async (textos) => {
      chamadas.push(textos.length);
      return textos.map((_, i) => [i, 0, 0]);
    },
    embedQuery: async () => [0, 0, 0],
  };
  return { embeddings, chamadas };
}

describe('seedDocumentos', () => {
  it('gera embeddings em lotes de 10, não um por documento', async () => {
    const { embeddings, chamadas } = fakeEmbeddings();
    const docs = Array.from({ length: 25 }, (_, i) => documento(i));

    const gravados = await seedDocumentos(docs, { embeddings, gravar: async () => {} });

    expect(TAMANHO_LOTE).toBe(10);
    expect(chamadas).toEqual([10, 10, 5]);
    expect(gravados).toBe(25);
  });

  it('grava cada documento com o embedding do seu próprio parágrafo', async () => {
    const { embeddings } = fakeEmbeddings();
    const gravadosNoBanco: DocumentoComEmbedding[] = [];

    await seedDocumentos([documento(0), documento(1)], {
      embeddings,
      gravar: async (lote) => {
        gravadosNoBanco.push(...lote);
      },
    });

    expect(gravadosNoBanco.map((d) => [d.ticker, d.embedding[0]])).toEqual([
      ['T0', 0],
      ['T1', 1],
    ]);
  });

  it('falha se o provedor devolver menos vetores que documentos', async () => {
    const embeddings: EmbeddingsInterface = {
      embedDocuments: async () => [[0]],
      embedQuery: async () => [0],
    };

    await expect(
      seedDocumentos([documento(0), documento(1)], { embeddings, gravar: async () => {} }),
    ).rejects.toThrow('1 vetores para 2 documentos');
  });
});

describe('documentoCorpusSchema', () => {
  it('aceita indicador nulo, mas nunca o converte em zero', () => {
    const doc = documentoCorpusSchema.parse(documento(0));
    expect(doc.lucroBruto).toBeNull();
  });

  it('rejeita período fora do formato do corpus', () => {
    expect(() => documentoCorpusSchema.parse({ ...documento(0), period: '2025Q3' })).toThrow();
  });
});
