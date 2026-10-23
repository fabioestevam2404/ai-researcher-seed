import { SearchProviderError, type SearchProvider, type SearchResult } from './types.js';

export const TENTATIVAS = 3;
export const ESPERA_INICIAL_MS = 500;
export const FALHAS_PARA_ABRIR = 3;
export const RESFRIAMENTO_MS = 30_000;

// A API reconhece este erro pelo nome (duck typing), sem importar o pacote do agente.
// Renomear a classe quebra o mapeamento para 503 — há teste cobrindo isso.
export class CircuitoAbertoError extends Error {
  constructor() {
    super('Busca web temporariamente indisponível: circuito aberto.');
    this.name = 'CircuitoAbertoError';
  }
}

// Relógio e espera são injetáveis: o teste avança o tempo sem esperar de verdade.
export interface OpcoesResiliencia {
  agora?: () => number;
  esperar?: (ms: number) => Promise<void>;
}

function esperarDeVerdade(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Erro de rede, timeout, 429 e 5xx podem passar sozinhos. Os demais 4xx (chave inválida,
// requisição malformada) dão o mesmo resultado em qualquer tentativa.
function valeTentarDeNovo(error: unknown): boolean {
  if (error instanceof SearchProviderError) {
    return error.status === 429 || error.status >= 500;
  }
  return true;
}

// Decorator: devolve um SearchProvider com a mesma interface, que acrescenta retry com
// backoff exponencial e um circuit breaker. O nó webSearch não sabe que ele existe.
export function comResiliencia(
  provider: SearchProvider,
  { agora = Date.now, esperar = esperarDeVerdade }: OpcoesResiliencia = {},
): SearchProvider {
  let falhasSeguidas = 0;
  let abertoAte = 0;

  async function buscarComRetry(query: string): Promise<SearchResult[]> {
    for (let tentativa = 1; ; tentativa++) {
      try {
        return await provider.search(query);
      } catch (error) {
        if (tentativa >= TENTATIVAS || !valeTentarDeNovo(error)) throw error;
        // 500 ms, depois 1000 ms: cada espera dobra a anterior.
        await esperar(ESPERA_INICIAL_MS * 2 ** (tentativa - 1));
      }
    }
  }

  return {
    async search(query) {
      // Circuito aberto: falha na hora, sem gastar cota nem tempo com um fornecedor fora do ar.
      if (agora() < abertoAte) throw new CircuitoAbertoError();

      // Passado o resfriamento, a próxima chamada é o teste: se der certo, o contador zera e o
      // circuito fecha; se falhar, o contador já está no limite e o circuito reabre.
      try {
        const resultados = await buscarComRetry(query);
        falhasSeguidas = 0;
        return resultados;
      } catch (error) {
        falhasSeguidas += 1;
        if (falhasSeguidas >= FALHAS_PARA_ABRIR) {
          abertoAte = agora() + RESFRIAMENTO_MS;
        }
        throw error;
      }
    },
  };
}
