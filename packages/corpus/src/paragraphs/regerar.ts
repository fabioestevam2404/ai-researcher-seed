import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarDocumentos } from './montar-documentos.js';
import type { DocumentoFinal } from '../types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCUMENTOS_DIR = path.join(HERE, '../../data/documentos');

// Regera só o parágrafo dos documentos versionados, a partir dos indicadores que já estão no
// JSON. Não baixa nada da CVM: o snapshot (trimestres, valores, fetchedAt) fica igual. Use quando
// o template mudar; depois, rode o seed para regravar os embeddings.
//
//   pnpm --filter @hero/corpus run regerar
for (const arquivo of readdirSync(DOCUMENTOS_DIR).filter((nome) => nome.endsWith('.json'))) {
  const caminho = path.join(DOCUMENTOS_DIR, arquivo);
  const documentos = JSON.parse(readFileSync(caminho, 'utf-8')) as DocumentoFinal[];

  // Os indicadores entram como estavam; o parágrafo antigo é substituído pelo do template atual.
  const regerados = montarDocumentos(documentos);

  writeFileSync(caminho, `${JSON.stringify(regerados, null, 2)}\n`);
  console.log(`${arquivo}: ${regerados.length} parágrafo(s) regerado(s).`);
}
