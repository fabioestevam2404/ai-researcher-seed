import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { urlZipCvm, type TipoDocumento } from './cvm-urls.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(HERE, '../../.cache');

/**
 * Sinaliza especificamente um 404 da CVM (ano/tipo ainda não publicado, ex.: DFP do ano
 * corrente antes do prazo de entrega) — distinto de qualquer outra falha de rede/HTTP, que
 * continua estourando normal. Quem chama decide se isso é "trimestre indisponível" (ignora
 * e segue com o que já tem) ou um erro de verdade.
 */
export class ArquivoCvmNaoEncontradoError extends Error {
  constructor(url: string) {
    super(`Arquivo não encontrado na CVM: ${url}`);
    this.name = 'ArquivoCvmNaoEncontradoError';
  }
}

/** Baixa e descompacta o ZIP anual da CVM (ITR ou DFP), reaproveitando o cache local entre execuções. */
export async function baixarEDescompactar(tipo: TipoDocumento, ano: number): Promise<string> {
  const destino = path.join(CACHE_DIR, `${tipo.toLowerCase()}_${ano}`);
  if (existsSync(destino) && readdirSync(destino).length > 0) {
    return destino;
  }

  const url = urlZipCvm(tipo, ano);
  const resposta = await fetch(url);
  if (resposta.status === 404) {
    throw new ArquivoCvmNaoEncontradoError(url);
  }
  if (!resposta.ok) {
    throw new Error(`Falha ao baixar ${url}: HTTP ${resposta.status}`);
  }
  const buffer = Buffer.from(await resposta.arrayBuffer());

  mkdirSync(destino, { recursive: true });
  new AdmZip(buffer).extractAllTo(destino, true);

  return destino;
}
