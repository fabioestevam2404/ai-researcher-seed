import type { IndicadorTrimestral, PeriodoColetado, ValorConta } from '../types.js';

/** A CVM publica em milhares de reais por padrão — a conversão para reais acontece aqui, uma única vez. */
function paraReais(valor: ValorConta): number {
  const fator = valor.escalaMoeda === 'MIL' ? 1000 : 1;
  return valor.valor * fator;
}

export function paraCanonico(
  periodo: PeriodoColetado,
  fetchedAt: string = new Date().toISOString(),
): IndicadorTrimestral {
  const { indicadores } = periodo;

  return {
    ticker: periodo.empresa.ticker,
    companyName: periodo.empresa.razaoSocial,
    setor: periodo.empresa.setor,
    period: periodo.period,
    periodEnd: periodo.periodEnd,
    receitaLiquida: paraReais(indicadores.receitaLiquida),
    lucroBruto: paraReais(indicadores.lucroBruto),
    lucroLiquido: paraReais(indicadores.lucroLiquido),
    ativoTotal: paraReais(indicadores.ativoTotal),
    patrimonioLiquido: paraReais(indicadores.patrimonioLiquido),
    caixaOperacional: paraReais(indicadores.caixaOperacional),
    sourceUrl: periodo.sourceUrl,
    fetchedAt,
    receitaMesmoTrimestreAnoAnterior: periodo.receitaMesmoTrimestreAnoAnterior
      ? paraReais(periodo.receitaMesmoTrimestreAnoAnterior)
      : undefined,
  };
}
