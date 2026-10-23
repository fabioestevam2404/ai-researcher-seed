import { describe, expect, it } from 'vitest';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { AVISO_GUARDRAIL } from '../answer/format-resposta.js';
import type { DocumentoRecuperado } from '../documento.js';
import {
  ANSWER_SYSTEM_PROMPT,
  AVISO_CONTEXTO_INCOMPLETO,
  answerPrompt,
} from '../prompts/answer.js';
import { makeAnswerNode } from './answer.js';

const documento: DocumentoRecuperado = {
  origem: 'cvm',
  ticker: 'PETR',
  companyName: 'Petróleo Brasileiro S.A. - Petrobras',
  period: '3T25',
  periodEnd: '2025-09-30',
  content: 'No 3T25, a Petrobras reportou lucro líquido de R$ 32,7 bilhões.',
  sourceUrl: 'https://dados.cvm.gov.br/x.zip',
  similaridade: 0.9,
};

describe('makeAnswerNode', () => {
  it('resposta normal sai com o texto do modelo e o bloco de fontes', async () => {
    const llm = new FakeListChatModel({
      responses: ['A Petrobras teve lucro líquido de R$ 32,7 bilhões no 3T25.'],
    });

    const { answerText } = await makeAnswerNode(llm)({
      question: 'Lucro da Petrobras no 3T25?',
      documents: [documento],
      sufficient: true,
    });

    expect(answerText).toContain('R$ 32,7 bilhões no 3T25');
    expect(answerText).toContain('Fontes:\n- PETR · 3T25 (data-base 2025-09-30)');
  });

  // TESTE DE GUARDRAIL OBRIGATÓRIO — não remova. Se ele quebrar, o problema é o
  // comportamento do sistema, não o teste (ver "Domínio: restrição regulatória" no CLAUDE.md).
  it('"devo comprar?": se o LLM recomendar, nada da recomendação chega ao usuário', async () => {
    const llm = new FakeListChatModel({
      responses: ['Eu recomendo comprar PETR4 agora, é uma ótima oportunidade.'],
    });

    const { answerText } = await makeAnswerNode(llm)({
      question: 'Devo comprar PETR4?',
      documents: [documento],
      sufficient: true,
    });

    expect(answerText.startsWith(AVISO_GUARDRAIL)).toBe(true);
    expect(answerText).not.toMatch(/recomendo|ótima oportunidade/i);
    expect(answerText).toContain('PETR · 3T25 (data-base 2025-09-30)');
  });
});

describe('answerPrompt', () => {
  it('o próprio prompt já instrui a nunca recomendar e a não inventar número', () => {
    expect(ANSWER_SYSTEM_PROMPT).toContain(
      'Nunca recomende, sugira ou aconselhe comprar, vender ou manter',
    );
    expect(ANSWER_SYSTEM_PROMPT).toContain('restrição regulatória');
    expect(ANSWER_SYSTEM_PROMPT).toContain('Nunca invente, estime ou complete um número');
  });

  it('com contexto insuficiente, manda o modelo avisar o que falta', () => {
    const [, incompleto] = answerPrompt({
      question: 'x',
      documents: [documento],
      sufficient: false,
    });
    const [, completo] = answerPrompt({ question: 'x', documents: [documento], sufficient: true });

    expect(incompleto[1]).toContain(AVISO_CONTEXTO_INCOMPLETO);
    expect(completo[1]).not.toContain(AVISO_CONTEXTO_INCOMPLETO);
  });
});
