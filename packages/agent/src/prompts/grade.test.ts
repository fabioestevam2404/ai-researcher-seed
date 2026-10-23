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
    expect(human[1]).toContain('[CVM] Vale S.A. (VALE) · 3T25, data-base 2025-09-30');
    expect(human[1]).toContain('R$ 56,7 bilhões');
    expect(human[1]).toContain('Pergunta: Receita da Vale?');
  });

  it('identifica trechos da web pelo título, data de coleta e fonte', () => {
    const [, human] = gradePrompt({
      question: 'Último fato relevante da Vale?',
      documents: [
        {
          origem: 'web',
          title: 'Comunicados relevantes - Vale',
          content: 'A Vale comunica...',
          sourceUrl: 'https://vale.com/comunicados',
          fetchedAt: '2026-10-23T12:00:00.000Z',
          similaridade: 0.8,
        },
      ],
    });

    expect(human[1]).toContain(
      '[WEB] Comunicados relevantes - Vale · coletado em 2026-10-23 · https://vale.com/comunicados',
    );
  });

  it('a regra: CVM nunca responde pergunta qualitativa e nada pode ser inventado', () => {
    expect(GRADE_SYSTEM_PROMPT).toContain('NUNCA é respondida por documentos [CVM]');
    expect(GRADE_SYSTEM_PROMPT).toContain('fato relevante');
    expect(GRADE_SYSTEM_PROMPT).toContain('Nunca considere suficiente imaginando um número');
  });
});
