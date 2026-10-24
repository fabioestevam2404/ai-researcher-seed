import { describe, expect, it } from 'vitest';
import { AIMessage } from '@langchain/core/messages';
import type { LLMResult } from '@langchain/core/outputs';
import { ContadorDeTokens, type UsoDeTokens } from './contador-de-tokens.js';

// Resultado de chamada no formato que o LangChain entrega ao handleLLMEnd.
function resultado(entrada: number, saida: number): LLMResult {
  const message = new AIMessage({
    content: 'ok',
    usage_metadata: { input_tokens: entrada, output_tokens: saida, total_tokens: entrada + saida },
  });
  return { generations: [[{ text: 'ok', message }]] };
}

function iniciar(contador: ContadorDeTokens, runId: string, modelo: string) {
  contador.handleChatModelStart({} as never, [], runId, undefined, {}, [], {
    ls_model_name: modelo,
  });
}

describe('ContadorDeTokens', () => {
  it('liga início e fim pelo runId: cada chamada sai com o seu modelo e os seus tokens', () => {
    const usos: UsoDeTokens[] = [];
    const contador = new ContadorDeTokens((uso) => usos.push(uso));

    iniciar(contador, 'run-grade', 'gemini-3.5-flash-lite');
    iniciar(contador, 'run-answer', 'gemini-3.6-flash');
    contador.handleLLMEnd(resultado(900, 40), 'run-answer');
    contador.handleLLMEnd(resultado(1200, 15), 'run-grade');

    expect(usos).toEqual([
      { modelo: 'gemini-3.6-flash', tokensEntrada: 900, tokensSaida: 40 },
      { modelo: 'gemini-3.5-flash-lite', tokensEntrada: 1200, tokensSaida: 15 },
    ]);
  });

  it('chamada sem usage_metadata não conta nada (modelo falso do modo demo)', () => {
    const usos: UsoDeTokens[] = [];
    const contador = new ContadorDeTokens((uso) => usos.push(uso));

    iniciar(contador, 'run-1', 'fake');
    contador.handleLLMEnd({ generations: [[{ text: 'ok' }]] }, 'run-1');

    expect(usos).toEqual([]);
  });

  it('fim sem início conhecido ainda conta, com modelo "desconhecido"', () => {
    const usos: UsoDeTokens[] = [];
    new ContadorDeTokens((uso) => usos.push(uso)).handleLLMEnd(resultado(10, 2), 'run-x');

    expect(usos[0]).toMatchObject({ modelo: 'desconhecido', tokensEntrada: 10 });
  });
});
