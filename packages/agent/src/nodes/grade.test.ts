import { describe, expect, it } from 'vitest';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import type { DocumentoRecuperado } from '../documento.js';
import { makeGradeNode } from './grade.js';

const documento: DocumentoRecuperado = {
  origem: 'cvm',
  ticker: 'VALE',
  companyName: 'Vale S.A.',
  period: '3T25',
  periodEnd: '2025-09-30',
  content: 'No 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões.',
  sourceUrl: 'https://dados.cvm.gov.br/x.zip',
  similaridade: 0.9,
};

// LLM fake: devolve o JSON pré-definido como se fosse a saída estruturada do Vertex AI.
function fakeLlm(resposta: object) {
  return new FakeListChatModel({ responses: [JSON.stringify(resposta)] });
}

describe('makeGradeNode', () => {
  it('pergunta numérica coberta pelo contexto: suficiente, nada falta', async () => {
    const grade = makeGradeNode(fakeLlm({ sufficient: true, missingAspects: [] }));

    const update = await grade({ question: 'Receita da Vale no 3T25?', documents: [documento] });

    expect(update).toEqual({ sufficient: true, missingAspects: [], iterations: 1, consulta: null });
  });

  it('pergunta qualitativa: insuficiente, com o que falta para a busca web', async () => {
    const grade = makeGradeNode(
      fakeLlm({ sufficient: false, missingAspects: ['último fato relevante da Vale'] }),
    );

    const update = await grade({
      question: 'Qual foi o último fato relevante da Vale?',
      documents: [documento],
    });

    expect(update).toEqual({
      sufficient: false,
      missingAspects: ['último fato relevante da Vale'],
      iterations: 1,
      consulta: null,
    });
  });

  it('sem documentos: insuficiente sem chamar o LLM', async () => {
    const llm = fakeLlm({ sufficient: true, missingAspects: [] });
    let chamadas = 0;
    llm.invoke = async () => {
      chamadas += 1;
      throw new Error('não deveria chamar o LLM');
    };

    const update = await makeGradeNode(llm)({ question: 'Receita da Vale?', documents: [] });

    expect(update).toEqual({
      sufficient: false,
      missingAspects: [],
      iterations: 1,
      consulta: null,
    });
    expect(chamadas).toBe(0);
  });

  // RF-13: pergunta agregada ou comparativa. O grade só produz o pedido; quem decide a rota é
  // a aresta.
  it('pergunta agregada: insuficiente, com o pedido de consulta estruturada', async () => {
    const consulta = {
      indicadores: ['caixa_operacional'],
      tickers: [],
      periodos: [],
    };
    const grade = makeGradeNode(
      fakeLlm({ sufficient: false, missingAspects: ['caixa das 20 empresas'], consulta }),
    );

    const update = await grade({
      question: 'Caixa operacional das 20 empresas nos últimos 4 trimestres?',
      documents: [documento],
    });

    expect(update.consulta).toEqual(consulta);
  });

  it('contexto suficiente descarta a consulta, mesmo que o modelo mande uma', async () => {
    const grade = makeGradeNode(
      fakeLlm({
        sufficient: true,
        missingAspects: [],
        consulta: { indicadores: ['receita_liquida'], tickers: ['VALE'], periodos: [] },
      }),
    );

    const update = await grade({ question: 'Receita da Vale no 3T25?', documents: [documento] });

    expect(update.consulta).toBeNull();
  });

  it('consulta com indicador fora dos seis do corpus é recusada pelo schema', async () => {
    const grade = makeGradeNode(
      fakeLlm({
        sufficient: false,
        missingAspects: [],
        consulta: { indicadores: ['ebitda'], tickers: [], periodos: [] },
      }),
    );

    await expect(
      grade({ question: 'Ebitda das empresas?', documents: [documento] }),
    ).rejects.toThrow();
  });

  it('rejeita saída do LLM fora do schema em vez de decidir a rota no chute', async () => {
    const grade = makeGradeNode(fakeLlm({ suficiente: 'talvez' }));

    await expect(grade({ question: 'Receita da Vale?', documents: [documento] })).rejects.toThrow();
  });
});
