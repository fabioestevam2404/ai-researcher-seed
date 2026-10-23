export const TAMANHO_CHUNK = 1000;
export const SOBREPOSICAO_CHUNK = 100;

// Divide um texto longo em pedaços de ~1000 caracteres com 100 de sobreposição: uma ideia
// cortada no fim de um chunk reaparece no começo do seguinte, e a busca ainda a encontra.
export function dividirEmChunks(
  texto: string,
  tamanho = TAMANHO_CHUNK,
  sobreposicao = SOBREPOSICAO_CHUNK,
): string[] {
  if (sobreposicao >= tamanho) {
    throw new Error('A sobreposição precisa ser menor que o tamanho do chunk.');
  }

  const chunks: string[] = [];
  const passo = tamanho - sobreposicao;

  for (let inicio = 0; inicio < texto.length; inicio += passo) {
    chunks.push(texto.slice(inicio, inicio + tamanho));
    if (inicio + tamanho >= texto.length) break;
  }

  return chunks;
}
