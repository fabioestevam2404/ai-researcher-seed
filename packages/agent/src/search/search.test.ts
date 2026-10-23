import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeGoogleCustomSearchProvider } from './google-custom-search.js';
import { criarSearchProvider } from './index.js';
import { makeSerperProvider } from './serper.js';
import { SearchProviderError } from './types.js';

// fetch fake: nenhum teste sai para a rede nem consome a cota do fornecedor.
function stubFetch(status: number, corpo: unknown) {
  const fetchFake = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(corpo), { status }),
  );
  vi.stubGlobal('fetch', fetchFake);
  return fetchFake;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('makeSerperProvider', () => {
  it('faz POST com a chave no header e a query no corpo, mapeando organic[]', async () => {
    const fetchFake = stubFetch(200, {
      organic: [
        {
          title: 'Vale divulga fato relevante',
          snippet: 'A Vale informa...',
          link: 'https://ex.com/a',
        },
        { title: 'Sem link', snippet: 'ignorado' },
      ],
    });

    const resultados = await makeSerperProvider('chave-fake').search('Vale fato relevante');

    const [url, init] = fetchFake.mock.calls[0];
    expect(url).toBe('https://google.serper.dev/search');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('X-API-KEY')).toBe('chave-fake');
    expect(JSON.parse(String(init?.body))).toEqual({
      q: 'Vale fato relevante',
      gl: 'br',
      hl: 'pt-br',
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(resultados).toEqual([
      {
        title: 'Vale divulga fato relevante',
        snippet: 'A Vale informa...',
        url: 'https://ex.com/a',
      },
    ]);
  });

  it('lança SearchProviderError quando o Serper responde erro', async () => {
    stubFetch(403, { message: 'Unauthorized' });

    await expect(makeSerperProvider('chave-errada').search('x')).rejects.toBeInstanceOf(
      SearchProviderError,
    );
  });
});

describe('makeGoogleCustomSearchProvider', () => {
  it('faz GET com key, cx e q na query string, mapeando items[]', async () => {
    const fetchFake = stubFetch(200, {
      items: [{ title: 'Petrobras', snippet: 'Resultado', link: 'https://ex.com/p' }],
    });

    const resultados = await makeGoogleCustomSearchProvider('k', 'cx-1').search('Petrobras lucro');

    const url = new URL(String(fetchFake.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe('https://www.googleapis.com/customsearch/v1');
    expect(url.searchParams.get('key')).toBe('k');
    expect(url.searchParams.get('cx')).toBe('cx-1');
    expect(url.searchParams.get('q')).toBe('Petrobras lucro');
    expect(fetchFake.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(resultados).toEqual([
      { title: 'Petrobras', snippet: 'Resultado', url: 'https://ex.com/p' },
    ]);
  });
});

describe('criarSearchProvider', () => {
  it('usa o Serper por padrão', async () => {
    const fetchFake = stubFetch(200, { organic: [] });

    await criarSearchProvider({ SERPER_API_KEY: 'k' }).search('x');

    expect(String(fetchFake.mock.calls[0][0])).toContain('serper.dev');
  });

  it('usa o Google quando SEARCH_PROVIDER=google', async () => {
    const fetchFake = stubFetch(200, { items: [] });

    await criarSearchProvider({
      SEARCH_PROVIDER: 'google',
      GOOGLE_CSE_KEY: 'k',
      GOOGLE_CSE_CX: 'cx',
    }).search('x');

    expect(String(fetchFake.mock.calls[0][0])).toContain('googleapis.com/customsearch');
  });

  it('erro claro quando falta a chave do provider escolhido', () => {
    expect(() => criarSearchProvider({})).toThrow('SERPER_API_KEY não definido');
    expect(() => criarSearchProvider({ SEARCH_PROVIDER: 'google', GOOGLE_CSE_KEY: 'k' })).toThrow(
      'GOOGLE_CSE_CX não definido',
    );
  });

  it('erro claro para provider desconhecido', () => {
    expect(() => criarSearchProvider({ SEARCH_PROVIDER: 'bing' })).toThrow(
      'SEARCH_PROVIDER desconhecido: "bing"',
    );
  });
});
