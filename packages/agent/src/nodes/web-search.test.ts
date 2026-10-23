import { describe, expect, it } from 'vitest';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import type { NovoDocumentoWeb } from '../db/inserir-documentos-web.js';
import type { SearchProvider, SearchResult } from '../search/types.js';
import {
  makeWebSearchNode,
  MAX_CHUNKS_POR_PAGINA,
  MIN_CARACTERES_PAGINA,
  montarQueries,
} from './web-search.js';

const AGORA = new Date('2026-10-23T12:00:00.000Z');

// Página com conteúdo de verdade: o título seguido de texto suficiente para passar do
// mínimo de caracteres. Cabe num chunk só.
const RECHEIO = 'conteúdo '.repeat(60).trim();
function pagina(titulo: string): string {
  return `<p>${titulo} ${RECHEIO}</p>`;
}

function resultado(n: number): SearchResult {
  return { title: `Página ${n}`, snippet: '', url: `https://ex.com/${n}` };
}

// Monta o nó com todas as dependências falsas e registra o que cada uma recebeu.
function montar({
  resultados = [resultado(1)],
  paginas = { 'https://ex.com/1': pagina('Fato relevante da Vale') } as Record<string, string>,
} = {}) {
  const queriesBuscadas: string[] = [];
  const gravados: NovoDocumentoWeb[] = [];
  let lotesDeEmbedding = 0;

  const searchProvider: SearchProvider = {
    search: async (query) => {
      queriesBuscadas.push(query);
      return resultados;
    },
  };
  const embeddings: EmbeddingsInterface = {
    embedDocuments: async (textos) => {
      lotesDeEmbedding += 1;
      return textos.map(() => [1, 2, 3]);
    },
    embedQuery: async () => [0],
  };

  const webSearch = makeWebSearchNode({
    searchProvider,
    embeddings,
    buscarPagina: async (url) => {
      const html = paginas[url];
      if (html === undefined) throw new Error('fora do ar');
      return html;
    },
    inserirDocumentosWeb: async (docs) => {
      gravados.push(...docs);
    },
    agora: () => AGORA,
  });

  return { webSearch, queriesBuscadas, gravados, lotes: () => lotesDeEmbedding };
}

describe('montarQueries', () => {
  it('uma query por aspecto faltante, sempre com a pergunta junto', () => {
    expect(montarQueries('Vale?', ['fato relevante', 'motivo da queda'])).toEqual([
      'Vale? fato relevante',
      'Vale? motivo da queda',
    ]);
  });

  it('sem aspectos, a query é só a pergunta', () => {
    expect(montarQueries('Vale?', [])).toEqual(['Vale?']);
  });
});

describe('makeWebSearchNode', () => {
  it('grava os trechos da página com query, título, fonte e TTL de 7 dias', async () => {
    const { webSearch, gravados } = montar();

    const update = await webSearch({ question: 'Vale?', missingAspects: ['fato relevante'] });

    expect(update).toEqual({});
    expect(gravados).toEqual([
      {
        query: 'Vale? fato relevante',
        title: 'Página 1',
        content: `Fato relevante da Vale ${RECHEIO}`,
        sourceUrl: 'https://ex.com/1',
        fetchedAt: AGORA,
        expiresAt: new Date('2026-10-30T12:00:00.000Z'),
        embedding: [1, 2, 3],
      },
    ]);
  });

  it('usa só os 3 primeiros resultados de cada busca', async () => {
    const paginas = Object.fromEntries(
      [1, 2, 3, 4, 5].map((n) => [`https://ex.com/${n}`, pagina(`texto ${n}`)]),
    );
    const { webSearch, gravados } = montar({
      resultados: [1, 2, 3, 4, 5].map(resultado),
      paginas,
    });

    await webSearch({ question: 'Vale?', missingAspects: [] });

    expect(gravados.map((d) => d.sourceUrl)).toEqual([
      'https://ex.com/1',
      'https://ex.com/2',
      'https://ex.com/3',
    ]);
  });

  it('página fora do ar é ignorada; as outras seguem sendo gravadas', async () => {
    const { webSearch, gravados } = montar({
      resultados: [resultado(1), resultado(2)],
      paginas: { 'https://ex.com/2': pagina('ainda no ar') },
    });

    await webSearch({ question: 'Vale?', missingAspects: [] });

    expect(gravados.map((d) => d.sourceUrl)).toEqual(['https://ex.com/2']);
  });

  it('descarta página sem conteúdo de verdade (vídeo, login), que só traz rodapé', async () => {
    const rodape = '<footer>Sobre Imprensa Direitos autorais Termos Privacidade</footer>';
    const { webSearch, gravados } = montar({
      resultados: [resultado(1), resultado(2)],
      paginas: { 'https://ex.com/1': rodape, 'https://ex.com/2': pagina('notícia') },
    });

    await webSearch({ question: 'Vale?', missingAspects: [] });

    expect(rodape.length).toBeLessThan(MIN_CARACTERES_PAGINA);
    expect(gravados.map((d) => d.sourceUrl)).toEqual(['https://ex.com/2']);
  });

  it('se nenhuma página responde, não gera embedding nem grava nada', async () => {
    const { webSearch, gravados, lotes } = montar({ paginas: {} });

    await webSearch({ question: 'Vale?', missingAspects: [] });

    expect(gravados).toEqual([]);
    expect(lotes()).toBe(0);
  });

  it('limita os chunks por página para segurar o custo de embeddings', async () => {
    const { webSearch, gravados } = montar({
      paginas: { 'https://ex.com/1': `<p>${'palavra '.repeat(5000)}</p>` },
    });

    await webSearch({ question: 'Vale?', missingAspects: [] });

    expect(gravados).toHaveLength(MAX_CHUNKS_POR_PAGINA);
  });

  it('uma chamada de embedding por query, com todos os trechos juntos', async () => {
    const { webSearch, lotes, queriesBuscadas } = montar();

    await webSearch({ question: 'Vale?', missingAspects: ['a', 'b'] });

    expect(queriesBuscadas).toEqual(['Vale? a', 'Vale? b']);
    expect(lotes()).toBe(2);
  });
});
