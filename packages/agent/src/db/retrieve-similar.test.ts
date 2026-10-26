import { describe, expect, it } from 'vitest';
import type { DocumentoCvm, DocumentoWeb } from '../documento.js';
import { combinarPorSimilaridade, MAX_TRECHOS_WEB } from './retrieve-similar.js';

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

  it('a web ocupa no máximo MAX_TRECHOS_WEB vagas, mesmo mais parecida que a CVM', () => {
    const resultado = combinarPorSimilaridade(
      [cvm('3T25', 0.5), cvm('2T25', 0.4), cvm('1T25', 0.3)],
      [web('a', 0.95), web('b', 0.9), web('c', 0.85)],
      5,
    );

    expect(MAX_TRECHOS_WEB).toBe(2);
    expect(resultado.map((d) => d.origem)).toEqual(['web', 'web', 'cvm', 'cvm', 'cvm']);
    // Ficam os trechos web mais parecidos, não os primeiros que chegaram.
    expect(resultado.slice(0, 2).map((d) => d.similaridade)).toEqual([0.95, 0.9]);
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
