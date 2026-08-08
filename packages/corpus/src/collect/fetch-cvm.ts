import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { urlZipCvm, type TipoDocumento } from './cvm-urls.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(HERE, '../../.cache');

/** Baixa e descompacta o ZIP anual da CVM (ITR ou DFP), reaproveitando o cache local entre execuções. */
export async function baixarEDescompactar(tipo: TipoDocumento, ano: number): Promise<string> {
  const destino = path.join(CACHE_DIR, `${tipo.toLowerCase()}_${ano}`);
  if (existsSync(destino) && readdirSync(destino).length > 0) {
    return destino;
  }

  const url = urlZipCvm(tipo, ano);
  const resposta = await fetch(url);
  if (!resposta.ok) {
    throw new Error(`Falha ao baixar ${url}: HTTP ${resposta.status}`);
  }
  const buffer = Buffer.from(await resposta.arrayBuffer());

  mkdirSync(destino, { recursive: true });
  new AdmZip(buffer).extractAllTo(destino, true);

  return destino;
}
