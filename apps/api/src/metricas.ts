import { Counter, Registry } from 'prom-client';

// Tokens de uma chamada de LLM. Mesmo formato do UsoDeTokens do agente, declarado aqui para a
// API não depender de tipos do pacote do agente fora da composição (index.ts).
export interface UsoDeTokens {
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
}

// Preço em US$ por 1 milhão de tokens, padrão do Vertex AI. ⚠ CONFERIR na página oficial
// (cloud.google.com/vertex-ai/generative-ai/pricing) antes de confiar no valor em dólar: em
// 2026-10-24 ela não pôde ser lida e os números abaixo vêm de agregadores. Onde as fontes
// divergiam, ficou o valor mais alto — superestimar custo é o erro seguro para um teto de gasto.
// Os tokens são exatos (usage_metadata); só a conversão para dólar depende desta tabela.
export const PRECOS_USD_POR_MILHAO: Record<string, { entrada: number; saida: number }> = {
  'gemini-3.5-flash-lite': { entrada: 0.3, saida: 2.5 },
  'gemini-3.6-flash': { entrada: 1.5, saida: 7.5 },
};

export function custoUsd({ modelo, tokensEntrada, tokensSaida }: UsoDeTokens): number {
  const preco = PRECOS_USD_POR_MILHAO[modelo];
  if (!preco) return 0;
  return (tokensEntrada * preco.entrada + tokensSaida * preco.saida) / 1_000_000;
}

export interface Metricas {
  registry: Registry;
  registrarUso(uso: UsoDeTokens): void;
  registrarPergunta(): void;
}

// Registry próprio (não o global do prom-client): cada build() tem o seu, e os testes não
// somam contadores entre si.
export function criarMetricas(): Metricas {
  const registry = new Registry();

  const tokens = new Counter({
    name: 'llm_tokens_total',
    help: 'Tokens de LLM consumidos, por modelo e tipo (entrada ou saída).',
    labelNames: ['modelo', 'tipo'] as const,
    registers: [registry],
  });

  const custo = new Counter({
    name: 'llm_cost_usd_total',
    help: 'Custo estimado de LLM em US$, pela tabela de preços da API (ver metricas.ts).',
    labelNames: ['modelo'] as const,
    registers: [registry],
  });

  // Denominador do custo médio: llm_cost_usd_total / chat_perguntas_total = custo por pergunta.
  const perguntas = new Counter({
    name: 'chat_perguntas_total',
    help: 'Perguntas aceitas pelo /api/chat (passaram da validação e do orçamento).',
    registers: [registry],
  });

  return {
    registry,
    registrarUso(uso) {
      tokens.inc({ modelo: uso.modelo, tipo: 'entrada' }, uso.tokensEntrada);
      tokens.inc({ modelo: uso.modelo, tipo: 'saida' }, uso.tokensSaida);
      custo.inc({ modelo: uso.modelo }, custoUsd(uso));
    },
    registrarPergunta() {
      perguntas.inc();
    },
  };
}
