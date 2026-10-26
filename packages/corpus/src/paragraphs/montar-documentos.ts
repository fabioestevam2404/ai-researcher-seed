import { gerarParagrafo } from './template.js';
import type { DocumentoFinal, IndicadorTrimestral } from '../types.js';

/**
 * Liga cada trimestre ao imediatamente anterior da mesma janela (para a comparação QoQ) e gera o
 * parágrafo. Usado pela coleta (dados novos da CVM) e pela regeração (dados já versionados).
 */
export function montarDocumentos(indicadores: IndicadorTrimestral[]): DocumentoFinal[] {
  const ordenados = [...indicadores].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));

  return ordenados.map((indicador, i) => {
    const anterior = ordenados[i - 1];
    const comparacoes = anterior
      ? { trimestreAnterior: { valor: anterior.receitaLiquida, period: anterior.period } }
      : {};
    return { ...indicador, paragraph: gerarParagrafo(indicador, comparacoes) };
  });
}
