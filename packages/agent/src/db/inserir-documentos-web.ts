import type { Db } from './client.js';
import { documentosWeb } from './schema.js';

export interface NovoDocumentoWeb {
  query: string;
  title: string;
  content: string;
  sourceUrl: string;
  fetchedAt: Date;
  expiresAt: Date;
  embedding: number[];
}

export type InserirDocumentosWeb = (documentos: NovoDocumentoWeb[]) => Promise<void>;

export function criarInserirDocumentosWeb(db: Db): InserirDocumentosWeb {
  return async (documentos) => {
    if (documentos.length === 0) return;
    await db.insert(documentosWeb).values(documentos);
  };
}
