import {
  SearchProviderError,
  TIMEOUT_BUSCA_MS,
  type SearchProvider,
  type SearchResult,
} from './types.js';

const GOOGLE_CSE_URL = 'https://www.googleapis.com/customsearch/v1';

interface GoogleCustomSearchResponse {
  items?: Array<{ title?: string; snippet?: string; link?: string }>;
}

// O Google Custom Search não aceita chaves novas e será desligado em 2027-01-01. Fica
// como segunda implementação do contrato — prova de que trocar de fornecedor é só trocar
// a variável SEARCH_PROVIDER.
export function makeGoogleCustomSearchProvider(apiKey: string, cx: string): SearchProvider {
  return {
    async search(query: string): Promise<SearchResult[]> {
      const url = new URL(GOOGLE_CSE_URL);
      url.searchParams.set('key', apiKey);
      url.searchParams.set('cx', cx);
      url.searchParams.set('q', query);

      const resposta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_BUSCA_MS) });

      if (!resposta.ok) {
        throw new SearchProviderError('Google Custom Search', resposta.status);
      }

      const corpo = (await resposta.json()) as GoogleCustomSearchResponse;

      return (corpo.items ?? [])
        .filter((item) => item.link)
        .map((item) => ({
          title: item.title ?? '',
          snippet: item.snippet ?? '',
          url: item.link ?? '',
        }));
    },
  };
}
