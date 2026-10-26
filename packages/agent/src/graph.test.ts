import { describe, expect, it, vi } from 'vitest';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { AVISO_GUARDRAIL } from './answer/format-resposta.js';
import type { DocumentoRecuperado } from './documento.js';
import { buildGraph, MAX_ITERATIONS, type GraphDeps } from './graph.js';
import { AVISO_CONTEXTO_INCOMPLETO } from './prompts/answer.js';

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

// Grafo inteiro com fakes. O grade fake devolve, em ordem, as avaliações da lista; o
// answer fake devolve sempre o mesmo texto.
function depsCom(
  avaliacoes: Array<{ sufficient: boolean; missingAspects: string[]; consulta?: object }>,
  respostaDoAnswer = 'A Vale reportou receita líquida de R$ 56,7 bilhões no 3T25.',
): GraphDeps {
  return {
    embeddings,
    buscar: async () => [documentoVale],
    gradeLlm: new FakeListChatModel({ responses: avaliacoes.map((a) => JSON.stringify(a)) }),
    answerLlm: new FakeListChatModel({ responses: [respostaDoAnswer] }),
    searchProvider: { search: async () => [] },
    buscarPagina: async () => '',
    inserirDocumentosWeb: async () => {},
    consultarIndicadores: async () => [documentoVale],
  };
}

// Roda o grafo com app.stream() e devolve a sequência de nós visitados e o texto final.
async function executar(deps: GraphDeps, question = 'Receita da Vale no 3T25?') {
  const visitados: string[] = [];
  let answerText = '';
  for await (const passo of await buildGraph(deps).stream(
    { question },
    { streamMode: 'updates' },
  )) {
    visitados.push(...Object.keys(passo));
    if ('answer' in passo) answerText = passo.answer.answerText;
  }
  return { visitados, answerText };
}

describe('buildGraph', () => {
  it('contexto suficiente na primeira rodada: retrieve → grade → answer, sem web', async () => {
    const { visitados, answerText } = await executar(
      depsCom([{ sufficient: true, missingAspects: [] }]),
    );

    expect(visitados).toEqual(['retrieve', 'grade', 'answer']);
    expect(answerText).toContain('R$ 56,7 bilhões');
    expect(answerText).toContain('VALE · 3T25 (data-base 2025-09-30)');
  });

  it('insuficiente e depois suficiente: o webSearch volta para o retrieve', async () => {
    const { visitados } = await executar(
      depsCom([
        { sufficient: false, missingAspects: ['fato relevante'] },
        { sufficient: true, missingAspects: [] },
      ]),
    );

    expect(visitados).toEqual(['retrieve', 'grade', 'webSearch', 'retrieve', 'grade', 'answer']);
  });

  it('o guard corta em exatamente MAX_ITERATIONS passadas pelo grade e ainda responde', async () => {
    const sempreInsuficiente = Array.from({ length: 10 }, () => ({
      sufficient: false,
      missingAspects: ['algo que a web também não tem'],
    }));

    const { visitados, answerText } = await executar(depsCom(sempreInsuficiente));

    expect(visitados.filter((no) => no === 'grade')).toHaveLength(MAX_ITERATIONS);
    expect(visitados).toEqual(['retrieve', 'grade', 'webSearch', 'retrieve', 'grade', 'answer']);
    expect(answerText).not.toBe('');
  });

  // RF-13: com o pedido de consulta, a aresta leva aos dados exatos do banco, e não à web.
  it('pergunta agregada: grade pede consulta → queryIndicators → answer, sem busca web', async () => {
    const consultas: unknown[] = [];
    const deps = depsCom([
      {
        sufficient: false,
        missingAspects: ['caixa das 20 empresas'],
        consulta: { indicadores: ['caixa_operacional'], tickers: [], periodos: [] },
      },
    ]);
    deps.consultarIndicadores = async (consulta) => {
      consultas.push(consulta);
      return [documentoVale];
    };
    let buscasWeb = 0;
    deps.searchProvider = {
      search: async () => {
        buscasWeb += 1;
        return [];
      },
    };

    const { visitados } = await executar(deps, 'Caixa operacional das 20 empresas?');

    expect(visitados).toEqual(['retrieve', 'grade', 'queryIndicators', 'answer']);
    expect(consultas).toEqual([{ indicadores: ['caixa_operacional'], tickers: [], periodos: [] }]);
    expect(buscasWeb).toBe(0);
  });

  // CA-07: degradação graciosa. A busca web nunca responde, e mesmo assim a pergunta termina
  // em resposta real, com o answer instruído a avisar que o contexto está incompleto.
  it('busca web sempre falhando: o grafo ainda termina em answer, sinalizando contexto parcial', async () => {
    const sempreInsuficiente = Array.from({ length: 10 }, () => ({
      sufficient: false,
      missingAspects: ['último fato relevante'],
    }));
    const deps = depsCom(sempreInsuficiente);
    deps.searchProvider = {
      search: async () => {
        throw new Error('Serper fora do ar');
      },
    };
    const promptDoAnswer = vi.spyOn(deps.answerLlm, 'invoke');

    const { visitados, answerText } = await executar(deps, 'Último fato relevante da Vale?');

    expect(visitados).toEqual(['retrieve', 'grade', 'webSearch', 'retrieve', 'grade', 'answer']);
    expect(answerText).toContain('R$ 56,7 bilhões');
    expect(JSON.stringify(promptDoAnswer.mock.calls[0][0])).toContain(AVISO_CONTEXTO_INCOMPLETO);
  });

  // Guardrail de ponta a ponta no grafo — complementa o teste obrigatório do nó answer.
  it('"devo comprar?" com LLM que recomenda: o grafo entrega só o aviso e as fontes', async () => {
    const { answerText } = await executar(
      depsCom(
        [{ sufficient: true, missingAspects: [] }],
        'Eu recomendo comprar VALE3 no preço atual.',
      ),
      'Eu devo comprar a Vale no preço atual?',
    );

    expect(answerText.startsWith(AVISO_GUARDRAIL)).toBe(true);
    expect(answerText).not.toMatch(/recomendo/i);
  });
});
