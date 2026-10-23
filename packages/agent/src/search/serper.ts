import { SearchProviderError, type SearchProvider, type SearchResult } from './types.js';

const SERPER_URL = 'https://google.serper.dev/search';

interface SerperResponse {
  organic?: Array<{ title?: string; snippet?: string; link?: string }>;
}

export function makeSerperProvider(apiKey: string): SearchProvider {
  return {
    async search(query: string): Promise<SearchResult[]> {
      const resposta = await fetch(SERPER_URL, {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query }),
      });

      if (!resposta.ok) {
        throw new SearchProviderError('Serper', resposta.status);
      }

      const corpo = (await resposta.json()) as SerperResponse;

      return (corpo.organic ?? [])
        .filter((item) => item.link)
        .map((item) => ({
          title: item.title ?? '',
          snippet: item.snippet ?? '',
          url: item.link ?? '',
        }));
    },
  };
}
