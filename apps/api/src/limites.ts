// Limites de uso da API pública, lidos do ambiente num lugar só. Os padrões são os
// conservadores decididos para a primeira exposição (plan.md §9): dá para afrouxar trocando a
// variável no Cloud Run, sem mexer em código.
export interface Limites {
  // Requisições aceitas por janela, somando todos os clientes.
  rateLimitMax: number;
  // Janela no formato do @fastify/rate-limit ("1 minute", "30 seconds"...).
  rateLimitJanela: string;
  // Tokens de LLM (entrada + saída) que a API pode gastar por dia (UTC).
  orcamentoDiarioTokens: number;
}

export const LIMITES_PADRAO: Limites = {
  rateLimitMax: 10,
  rateLimitJanela: '1 minute',
  orcamentoDiarioTokens: 300_000,
};

function inteiroPositivo(nome: string, valor: string | undefined, padrao: number): number {
  if (valor === undefined || valor === '') return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error(`${nome} precisa ser um inteiro positivo, recebeu "${valor}".`);
  }
  return numero;
}

export function lerLimites(env: NodeJS.ProcessEnv = process.env): Limites {
  return {
    rateLimitMax: inteiroPositivo(
      'RATE_LIMIT_MAX',
      env.RATE_LIMIT_MAX,
      LIMITES_PADRAO.rateLimitMax,
    ),
    rateLimitJanela: env.RATE_LIMIT_WINDOW || LIMITES_PADRAO.rateLimitJanela,
    orcamentoDiarioTokens: inteiroPositivo(
      'DAILY_TOKEN_BUDGET',
      env.DAILY_TOKEN_BUDGET,
      LIMITES_PADRAO.orcamentoDiarioTokens,
    ),
  };
}
