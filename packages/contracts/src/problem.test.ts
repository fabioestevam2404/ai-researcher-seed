import { describe, expect, it } from 'vitest';
import { problemSchema } from './problem.js';

describe('problemSchema', () => {
  it('aceita um erro no formato RFC 7807, com detail opcional', () => {
    expect(
      problemSchema.safeParse({ type: 'about:blank', title: 'Erro interno', status: 500 }).success,
    ).toBe(true);
    expect(
      problemSchema.safeParse({
        type: 'about:blank',
        title: 'Requisição inválida',
        status: 400,
        detail: 'question é obrigatório',
      }).success,
    ).toBe(true);
  });

  it('recusa status que não é de erro', () => {
    expect(problemSchema.safeParse({ type: 'about:blank', title: 'ok', status: 200 }).success).toBe(
      false,
    );
  });
});
