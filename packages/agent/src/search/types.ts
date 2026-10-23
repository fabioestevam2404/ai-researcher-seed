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

export class SearchProviderError extends Error {
  constructor(provider: string, status: number) {
    super(`${provider} respondeu HTTP ${status}`);
    this.name = 'SearchProviderError';
  }
}
