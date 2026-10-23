import { describe, expect, it } from 'vitest';
import type { DocumentoCvm, DocumentoWeb } from '../documento.js';
import { combinarPorSimilaridade } from './retrieve-similar.js';

function cvm(period: string, similaridade: number): DocumentoCvm {
  return {
    origem: 'cvm',
    ticker: 'VALE',
    companyName: 'Vale S.A.',
    period,
    periodEnd: '2025-09-30',
    content: `parágrafo ${period}`,
    sourceUrl: 'https://dados.cvm.gov.br/x.zip',
    similaridade,
  };
}

function web(title: string, similaridade: number): DocumentoWeb {
  return {
    origem: 'web',
    title,
    content: `trecho ${title}`,
    sourceUrl: `https://ex.com/${title}`,
    fetchedAt: '2026-10-23T12:00:00.000Z',
    similaridade,
  };
}

describe('combinarPorSimilaridade', () => {
  it('intercala as duas fontes ordenando só pela proximidade da pergunta', () => {
    const resultado = combinarPorSimilaridade(
      [cvm('3T25', 0.9), cvm('2T25', 0.7)],
      [web('fato-relevante', 0.8), web('outra', 0.6)],
      5,
    );

    expect(resultado.map((d) => d.similaridade)).toEqual([0.9, 0.8, 0.7, 0.6]);
    expect(resultado.map((d) => d.origem)).toEqual(['cvm', 'web', 'cvm', 'web']);
  });

  it('corta no top-k depois de juntar, não antes', () => {
    const resultado = combinarPorSimilaridade(
      [cvm('3T25', 0.5), cvm('2T25', 0.4)],
      [web('a', 0.95), web('b', 0.9), web('c', 0.85)],
      3,
    );

    expect(resultado.map((d) => d.origem)).toEqual(['web', 'web', 'web']);
  });

  it('o mesmo trecho web gravado duas vezes ocupa uma vaga só', () => {
    const resultado = combinarPorSimilaridade(
      [cvm('3T25', 0.7)],
      [web('ri-vale', 0.8), web('ri-vale', 0.8)],
      5,
    );

    expect(resultado.map((d) => d.origem)).toEqual(['web', 'cvm']);
  });

  it('sem nada na web (ou tudo expirado), devolve só a CVM', () => {
    expect(combinarPorSimilaridade([cvm('3T25', 0.9)], [], 5)).toEqual([cvm('3T25', 0.9)]);
  });
});
