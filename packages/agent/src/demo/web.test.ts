import { describe, expect, it } from 'vitest';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import type { NovoDocumentoWeb } from '../db/inserir-documentos-web.js';
import { makeWebSearchNode, MIN_CARACTERES_PAGINA } from '../nodes/web-search.js';
import { criarSearchProvider } from '../search/index.js';
import { buscarPagina } from '../web/buscar-pagina.js';
import { extrairTexto } from '../web/extrair-texto.js';
import { criarBuscarPagina } from '../web/index.js';
import { fixtureGenerica, fixturesWeb } from './fixtures-web.js';
import { demoBuscarPagina, demoSearchProvider } from './web.js';

describe('busca web do modo demo', () => {
  it('escolhe a fixture pela empresa citada na query, ignorando acento e caixa', async () => {
    const [resultado] = await demoSearchProvider.search('O que motivou o prejuízo da KLABIN?');

    expect(resultado.url).toContain('klabin');
  });

  it('pergunta sobre empresa sem fixture recebe a página genérica', async () => {
    expect(await demoSearchProvider.search('Planos de expansão do Assaí')).toEqual([
      fixtureGenerica.resultado,
    ]);
  });

  it('toda página congelada passa do mínimo de caracteres e se declara fictícia', async () => {
    for (const fixture of [...fixturesWeb, fixtureGenerica]) {
      const texto = extrairTexto(await demoBuscarPagina(fixture.resultado.url));

      expect(texto.length).toBeGreaterThanOrEqual(MIN_CARACTERES_PAGINA);
      expect(texto).toContain('Conteúdo fictício de demonstração');
      expect(fixture.resultado.title).toMatch(/^\[DEMO\]/);
    }
  });

  it('URL fora das fixtures é erro, como uma página fora do ar', async () => {
    await expect(demoBuscarPagina('https://ex.com/real')).rejects.toThrow('página congelada');
  });

  it('o nó webSearch real grava os trechos da fixture sem tocar a rede', async () => {
    const gravados: NovoDocumentoWeb[] = [];
    const embeddings: EmbeddingsInterface = {
      embedDocuments: async (textos) => textos.map(() => [0]),
      embedQuery: async () => [0],
    };
    const webSearch = makeWebSearchNode({
      searchProvider: demoSearchProvider,
      buscarPagina: demoBuscarPagina,
      embeddings,
      inserirDocumentosWeb: async (docs) => {
        gravados.push(...docs);
      },
    });

    await webSearch({ question: 'Houve fato relevante da Petrobras?', missingAspects: [] });

    expect(gravados.length).toBeGreaterThan(0);
    expect(gravados.every((d) => d.sourceUrl.includes('petrobras'))).toBe(true);
  });
});

describe('composição com DEMO', () => {
  it('DEMO=true troca busca e página pelas fixtures e dispensa a chave do Serper', () => {
    expect(criarSearchProvider({ DEMO: 'true' })).toBe(demoSearchProvider);
    expect(criarBuscarPagina({ DEMO: 'true' })).toBe(demoBuscarPagina);
  });

  it('sem DEMO (ou com outro valor) usa as implementações reais', () => {
    expect(criarBuscarPagina({})).toBe(buscarPagina);
    expect(criarBuscarPagina({ DEMO: '1' })).toBe(buscarPagina);
    expect(() => criarSearchProvider({ DEMO: 'false' })).toThrow('SERPER_API_KEY não definido');
  });
});
