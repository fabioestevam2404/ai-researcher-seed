// Contrato do adapter: o nó webSearch não sabe se do outro lado está o Serper, o Google
// ou qualquer outro fornecedor — ele só conhece esta forma.
export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>;
}

// Sem timeout, o fetch espera para sempre: um fornecedor travado travaria o grafo inteiro.
export const TIMEOUT_BUSCA_MS = 10_000;

export class SearchProviderError extends Error {
  // O status fica disponível para a resiliência decidir se vale tentar de novo.
  constructor(
    provider: string,
    readonly status: number,
  ) {
    super(`${provider} respondeu HTTP ${status}`);
    this.name = 'SearchProviderError';
  }
}
