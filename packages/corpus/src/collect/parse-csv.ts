import { readFileSync } from 'node:fs';
import type { LinhaCvm } from '../types.js';

/**
 * Os CSVs da CVM são ISO-8859-1, separados por `;`, sem aspas em nenhum campo
 * observado — um split simples é suficiente e evita puxar uma lib de parsing RFC4180.
 */
export function parseCsvCvm(caminho: string): LinhaCvm[] {
  const conteudo = readFileSync(caminho, 'latin1');
  const linhas = conteudo.split(/\r?\n/).filter((linha) => linha.length > 0);
  const [linhaHeader, ...resto] = linhas;
  const header = linhaHeader.split(';');

  return resto.map((linha) => {
    const campos = linha.split(';');
    const registro: LinhaCvm = {};
    header.forEach((chave, i) => {
      registro[chave] = campos[i] ?? '';
    });
    return registro;
  });
}
