import { describe, expect, it } from 'vitest';
import { CallbackHandler } from '@langfuse/langchain';
import { criarCallbacksLangfuse, iniciarTelemetria, langfuseConfigurado } from './langfuse.js';

// Nenhum teste aqui liga o SDK nem fala com o Langfuse: só a decisão de ligar ou não.
describe('Langfuse opcional', () => {
  it('sem as duas chaves, não liga nada e não cria callback', () => {
    expect(langfuseConfigurado({})).toBe(false);
    expect(langfuseConfigurado({ LANGFUSE_PUBLIC_KEY: 'pk' })).toBe(false);
    expect(iniciarTelemetria({})).toBe(false);
    expect(criarCallbacksLangfuse({})).toEqual([]);
  });

  it('com as chaves, cada pergunta ganha um CallbackHandler novo', () => {
    const env = { LANGFUSE_PUBLIC_KEY: 'pk-teste', LANGFUSE_SECRET_KEY: 'sk-teste' };

    const [primeira] = criarCallbacksLangfuse(env);
    const [segunda] = criarCallbacksLangfuse(env);

    expect(primeira).toBeInstanceOf(CallbackHandler);
    expect(segunda).not.toBe(primeira);
  });
});
