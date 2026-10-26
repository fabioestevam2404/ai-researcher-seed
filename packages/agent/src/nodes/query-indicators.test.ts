import { describe, expect, it } from 'vitest';
import type { Consulta } from '../consulta.js';
import { formatarMoeda, linhaParaDocumento } from '../db/consultar-indicadores.js';
import { makeQueryIndicatorsNode } from './query-indicators.js';

const linhaVale = {
  ticker: 'VALE',
  companyName: 'Vale S.A.',
  period: '1T26',
  periodEnd: '2026-03-31',
  sourceUrl: 'https://dados.cvm.gov.br/x.zip',
  valores: { receita_liquida: 48_700_000_000, caixa_operacional: null },
};

describe('linhaParaDocumento', () => {
  it('só os indicadores pedidos, com período e data-base, citável como documento da CVM', () => {
    const doc = linhaParaDocumento(linhaVale, ['receita_liquida']);

    expect(doc).toMatchObject({
      origem: 'cvm',
      ticker: 'VALE',
      period: '1T26',
      periodEnd: '2026-03-31',
      content: 'No 1T26, a Vale S.A.: receita líquida R$ 48,7 bilhões.',
    });
  });

  it('indicador ausente aparece como "não informado", nunca como zero', () => {
    expect(linhaParaDocumento(linhaVale, ['caixa_operacional']).content).toContain(
      'caixa gerado nas operações não informado',
    );
  });
});

describe('formatarMoeda', () => {
  it('mesmo formato do parágrafo do corpus: bilhões ou milhões, uma casa, separador de milhar', () => {
    expect(formatarMoeda(3_171_201_000_000)).toBe('R$ 3.171,2 bilhões');
    expect(formatarMoeda(-55_220_000)).toBe('R$ -55,2 milhões');
  });
});

describe('makeQueryIndicatorsNode', () => {
  const consulta: Consulta = { indicadores: ['receita_liquida'], tickers: ['VALE'], periodos: [] };

  it('troca os documentos pelas linhas da consulta e marca o contexto como suficiente', async () => {
    const pedidas: Consulta[] = [];
    const node = makeQueryIndicatorsNode({
      consultar: async (c) => {
        pedidas.push(c);
        return [linhaParaDocumento(linhaVale, c.indicadores)];
      },
    });

    const update = await node({ consulta });

    expect(pedidas).toEqual([consulta]);
    expect(update.sufficient).toBe(true);
    expect(update.documents).toHaveLength(1);
  });

  it('consulta sem resultado deixa o contexto insuficiente (o answer avisa)', async () => {
    const node = makeQueryIndicatorsNode({ consultar: async () => [] });

    expect(await node({ consulta })).toEqual({ documents: [], sufficient: false });
  });
});
