import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import type { InserirDocumentosWeb, NovoDocumentoWeb } from '../db/inserir-documentos-web.js';
import type { SearchProvider } from '../search/types.js';
import type { BuscarPagina } from '../web/buscar-pagina.js';
import { dividirEmChunks } from '../web/dividir-em-chunks.js';
import { extrairTexto } from '../web/extrair-texto.js';

export const RESULTADOS_POR_QUERY = 3;
export const TTL_PADRAO_DIAS = 7;
// Uma notícia longa viraria dezenas de chunks e dezenas de embeddings. O começo da página
// costuma ter o essencial; o limite segura o custo por pergunta.
export const MAX_CHUNKS_POR_PAGINA = 10;
// Abaixo disso a página não tem conteúdo de verdade (vídeo, login, bloqueio): o texto
// extraído é só menu e rodapé, e gravá-lo poluiria o RAG.
export const MIN_CARACTERES_PAGINA = 500;

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export interface WebSearchDeps {
  searchProvider: SearchProvider;
  buscarPagina: BuscarPagina;
  embeddings: EmbeddingsInterface;
  inserirDocumentosWeb: InserirDocumentosWeb;
  ttlDias?: number;
  /** Relógio injetável: o teste confere a data de expiração sem depender da hora real. */
  agora?: () => Date;
}

// Busca só o que o grade apontou como faltante — mandar a pergunta inteira tornaria a
// avaliação do grade inútil. Sem aspectos, a query é a própria pergunta.
export function montarQueries(question: string, missingAspects: string[]): string[] {
  if (missingAspects.length === 0) return [question];
  return missingAspects.map((aspecto) => `${question} ${aspecto}`);
}

// O nó não avalia nem decide rota: grava os trechos no banco e o grafo volta para o
// retrieve, que passa a encontrá-los junto com o corpus da CVM. Por isso não devolve
// campo de estado novo.
export function makeWebSearchNode({
  searchProvider,
  buscarPagina,
  embeddings,
  inserirDocumentosWeb,
  ttlDias = TTL_PADRAO_DIAS,
  agora = () => new Date(),
}: WebSearchDeps) {
  return async (state: { question: string; missingAspects: string[] }): Promise<object> => {
    for (const query of montarQueries(state.question, state.missingAspects)) {
      const resultados = (await searchProvider.search(query)).slice(0, RESULTADOS_POR_QUERY);
      const trechos: Array<{ title: string; sourceUrl: string; content: string }> = [];

      for (const resultado of resultados) {
        try {
          const texto = extrairTexto(await buscarPagina(resultado.url));
          if (texto.length < MIN_CARACTERES_PAGINA) continue;
          for (const content of dividirEmChunks(texto).slice(0, MAX_CHUNKS_POR_PAGINA)) {
            trechos.push({ title: resultado.title, sourceUrl: resultado.url, content });
          }
        } catch {
          // Página fora do ar ou lenta demais: ignora este resultado e segue com os outros.
        }
      }

      if (trechos.length === 0) continue;

      const vetores = await embeddings.embedDocuments(trechos.map((trecho) => trecho.content));
      const fetchedAt = agora();
      const expiresAt = new Date(fetchedAt.getTime() + ttlDias * UM_DIA_MS);

      const documentos: NovoDocumentoWeb[] = trechos.map((trecho, i) => ({
        query,
        ...trecho,
        fetchedAt,
        expiresAt,
        embedding: vetores[i],
      }));

      await inserirDocumentosWeb(documentos);
    }

    return {};
  };
}
