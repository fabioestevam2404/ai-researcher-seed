import { demoBuscar, demoConsultarIndicadores, demoInserirDocumentosWeb } from '../demo/grafo.js';
import { modoDemo } from '../demo/modo-demo.js';
import { criarDb } from './client.js';
import { criarConsultarIndicadores, type ConsultarIndicadores } from './consultar-indicadores.js';
import { criarInserirDocumentosWeb, type InserirDocumentosWeb } from './inserir-documentos-web.js';
import {
  criarBuscarDocumentosSimilares,
  type BuscarDocumentosSimilares,
} from './retrieve-similar.js';

export interface Persistencia {
  buscar: BuscarDocumentosSimilares;
  inserirDocumentosWeb: InserirDocumentosWeb;
  consultarIndicadores: ConsultarIndicadores;
}

// Composição do acesso ao banco. No modo demo o Postgres nem é aberto: a busca devolve o
// documento congelado e nada é gravado — o demo não deixa trecho fictício no banco.
export function criarPersistencia(env: NodeJS.ProcessEnv = process.env): Persistencia {
  if (modoDemo(env)) {
    return {
      buscar: demoBuscar,
      inserirDocumentosWeb: demoInserirDocumentosWeb,
      consultarIndicadores: demoConsultarIndicadores,
    };
  }

  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL não definido.');

  const { db } = criarDb(databaseUrl);
  return {
    buscar: criarBuscarDocumentosSimilares(db),
    inserirDocumentosWeb: criarInserirDocumentosWeb(db),
    consultarIndicadores: criarConsultarIndicadores(db),
  };
}
