import { describe, expect, it } from 'vitest';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import type { DocumentoRecuperado } from './documento.js';
import { buildGraph, MAX_ITERATIONS, type GraphDeps } from './graph.js';

const documentoVale: DocumentoRecuperado = {
  origem: 'cvm',
  ticker: 'VALE',
  companyName: 'Vale S.A.',
  period: '3T25',
  periodEnd: '2025-09-30',
  content: 'No 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões.',
  sourceUrl: 'https://dados.cvm.gov.br/x.zip',
  similaridade: 0.9,
};

const embeddings: EmbeddingsInterface = {
  embedQuery: async () => [0, 0, 0],
  embedDocuments: async (textos) => textos.map(() => [0, 0, 0]),
};

// Grafo inteiro com fakes. O grade fake devolve, em ordem, as avaliações da lista.
function depsCom(avaliacoes: Array<{ sufficient: boolean; missingAspects: string[] }>): GraphDeps {
  return {
    embeddings,
    buscar: async () => [documentoVale],
    gradeLlm: new FakeListChatModel({ responses: avaliacoes.map((a) => JSON.stringify(a)) }),
    searchProvider: { search: async () => [] },
    buscarPagina: async () => '',
    inserirDocumentosWeb: async () => {},
  };
}

// Roda o grafo com app.stream() e devolve a sequência de nós visitados.
async function nosVisitados(deps: GraphDeps, question = 'Receita da Vale no 3T25?') {
  const visitados: string[] = [];
  for await (const passo of await buildGraph(deps).stream(
    { question },
    { streamMode: 'updates' },
  )) {
    visitados.push(...Object.keys(passo));
  }
  return visitados;
}

describe('buildGraph', () => {
  it('contexto suficiente na primeira rodada: retrieve → grade e fim, sem web', async () => {
    const visitados = await nosVisitados(depsCom([{ sufficient: true, missingAspects: [] }]));

    expect(visitados).toEqual(['retrieve', 'grade']);
  });

  it('insuficiente e depois suficiente: o webSearch volta para o retrieve', async () => {
    const visitados = await nosVisitados(
      depsCom([
        { sufficient: false, missingAspects: ['fato relevante'] },
        { sufficient: true, missingAspects: [] },
      ]),
    );

    expect(visitados).toEqual(['retrieve', 'grade', 'webSearch', 'retrieve', 'grade']);
  });

  it('o guard corta em exatamente MAX_ITERATIONS passadas pelo grade', async () => {
    const sempreInsuficiente = Array.from({ length: 10 }, () => ({
      sufficient: false,
      missingAspects: ['algo que a web também não tem'],
    }));

    const visitados = await nosVisitados(depsCom(sempreInsuficiente));

    expect(visitados.filter((no) => no === 'grade')).toHaveLength(MAX_ITERATIONS);
    expect(visitados).toEqual(['retrieve', 'grade', 'webSearch', 'retrieve', 'grade']);
  });
});
