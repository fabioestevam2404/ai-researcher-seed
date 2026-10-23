import { describe, expect, it } from 'vitest';
import { chatEventSchema, chatRequestSchema } from './chat.js';

describe('chatRequestSchema', () => {
  it('aceita a pergunta e tira espaços das pontas', () => {
    expect(chatRequestSchema.parse({ question: '  Receita da Vale?  ' })).toEqual({
      question: 'Receita da Vale?',
    });
  });

  it('recusa corpo sem pergunta ou com pergunta vazia', () => {
    expect(chatRequestSchema.safeParse({}).success).toBe(false);
    expect(chatRequestSchema.safeParse({ question: '   ' }).success).toBe(false);
  });
});

describe('chatEventSchema', () => {
  it('cada nó tem o seu formato de evento', () => {
    expect(
      chatEventSchema.parse({
        node: 'grade',
        durationMs: 120,
        sufficient: false,
        missingAspects: ['fato relevante'],
        iterations: 1,
      }).node,
    ).toBe('grade');
    expect(chatEventSchema.parse({ node: 'webSearch', durationMs: 900 }).node).toBe('webSearch');
  });

  it('recusa evento de answer sem o texto', () => {
    expect(chatEventSchema.safeParse({ node: 'answer', durationMs: 10 }).success).toBe(false);
  });
});
