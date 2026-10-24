import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarDb } from '../db/client.js';
import { criarUpsertDocumentos } from '../db/upsert-documentos.js';
import { criarEmbeddings } from '../llm/embeddings.js';
import { arquivoCorpusSchema, type DocumentoCorpus } from './documento-corpus.js';
import { garantirForaDoModoDemo, seedDocumentos } from './seed.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCUMENTOS_DIR = path.join(HERE, '../../../corpus/data/documentos');

async function lerCorpus(): Promise<DocumentoCorpus[]> {
  const arquivos = (await readdir(DOCUMENTOS_DIR)).filter((nome) => nome.endsWith('.json'));
  const documentos: DocumentoCorpus[] = [];

  for (const arquivo of arquivos.sort()) {
    const conteudo: unknown = JSON.parse(
      await readFile(path.join(DOCUMENTOS_DIR, arquivo), 'utf8'),
    );
    documentos.push(...arquivoCorpusSchema.parse(conteudo));
  }

  return documentos;
}

async function main() {
  // Primeira coisa, antes de ler corpus ou abrir o banco.
  garantirForaDoModoDemo();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não definido. Configure no .env da raiz.');
  }

  const documentos = await lerCorpus();
  console.log(`${documentos.length} documentos lidos do corpus.`);

  const { db, pool } = criarDb(databaseUrl);
  try {
    const gravados = await seedDocumentos(documentos, {
      embeddings: criarEmbeddings(),
      gravar: criarUpsertDocumentos(db),
    });
    console.log(`${gravados} documentos gravados (upsert por ticker e período).`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
