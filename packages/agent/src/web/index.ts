import { modoDemo } from '../demo/modo-demo.js';
import { demoBuscarPagina } from '../demo/web.js';
import { buscarPagina, type BuscarPagina } from './buscar-pagina.js';

// Composição do download de páginas: no modo demo, HTML congelado; fora dele, fetch real.
export function criarBuscarPagina(env: NodeJS.ProcessEnv = process.env): BuscarPagina {
  return modoDemo(env) ? demoBuscarPagina : buscarPagina;
}
