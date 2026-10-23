import { describe, expect, it } from 'vitest';
import type { DocumentoRecuperado } from '../documento.js';
import { GRADE_SYSTEM_PROMPT, gradePrompt } from './grade.js';

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

describe('gradePrompt', () => {
  it('envia a regra como system e o contexto + pergunta como human', () => {
    const [system, human] = gradePrompt({ question: 'Receita da Vale?', documents: [documento] });

    expect(system).toEqual(['system', GRADE_SYSTEM_PROMPT]);
    expect(human[0]).toBe('human');
    expect(human[1]).toContain('Vale S.A. (VALE) · 3T25, data-base 2025-09-30');
    expect(human[1]).toContain('R$ 56,7 bilhões');
    expect(human[1]).toContain('Pergunta: Receita da Vale?');
  });

  it('a regra trata pergunta qualitativa como insuficiente e proíbe inventar número', () => {
    expect(GRADE_SYSTEM_PROMPT).toContain('qualitativas são SEMPRE INSUFICIENTES');
    expect(GRADE_SYSTEM_PROMPT).toContain('fato relevante');
    expect(GRADE_SYSTEM_PROMPT).toContain('Nunca considere suficiente imaginando um número');
  });
});
