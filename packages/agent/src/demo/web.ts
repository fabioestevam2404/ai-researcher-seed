import type { SearchProvider } from '../search/types.js';
import type { BuscarPagina } from '../web/buscar-pagina.js';
import { fixtureGenerica, fixturesWeb } from './fixtures-web.js';

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// Mesma interface do Serper, sem rede: devolve as fixtures cujas palavras-chave aparecem na
// query, ou a genérica se nenhuma aparecer.
export const demoSearchProvider: SearchProvider = {
  async search(query) {
    const consulta = semAcento(query);
    const encontradas = fixturesWeb.filter((fixture) =>
      fixture.palavrasChave.some((palavra) => consulta.includes(palavra)),
    );
    return (encontradas.length > 0 ? encontradas : [fixtureGenerica]).map((f) => f.resultado);
  },
};

// Mesma assinatura do buscarPagina real: devolve o HTML congelado da URL de demonstração.
export const demoBuscarPagina: BuscarPagina = async (url) => {
  const fixture = [...fixturesWeb, fixtureGenerica].find((f) => f.resultado.url === url);
  if (!fixture) {
    throw new Error(`Modo demo não tem página congelada para ${url}`);
  }
  return fixture.html;
};
