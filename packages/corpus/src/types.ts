export interface Empresa {
  ticker: string;
  razaoSocial: string;
  /** 6 dígitos, zero à esquerda — mesmo formato do campo CD_CVM nos CSVs da CVM. */
  cdCvm: string;
  setor: string;
}

export type EscalaMoeda = 'MIL' | 'UNIDADE';

export interface ValorConta {
  valor: number;
  escalaMoeda: EscalaMoeda;
}

export interface IndicadoresBrutos {
  receitaLiquida: ValorConta;
  lucroBruto: ValorConta;
  lucroLiquido: ValorConta;
  ativoTotal: ValorConta;
  patrimonioLiquido: ValorConta;
  caixaOperacional: ValorConta;
}

export interface PeriodoColetado {
  empresa: Empresa;
  /** Ex.: "3T25" */
  period: string;
  /** Ex.: "2025-09-30" */
  periodEnd: string;
  sourceUrl: string;
  indicadores: IndicadoresBrutos;
  /**
   * Receita do mesmo trimestre do ano anterior, lida direto de ORDEM_EXERC=PENÚLTIMO
   * na mesma linha da CVM — usada para a comparação YoY. Nunca preenchida para o 4º
   * trimestre (ver "Simplificação deliberada" no plano).
   */
  receitaMesmoTrimestreAnoAnterior?: ValorConta;
}

export interface IndicadorTrimestral {
  ticker: string;
  companyName: string;
  setor: string;
  period: string;
  periodEnd: string;
  receitaLiquida: number;
  lucroBruto: number;
  lucroLiquido: number;
  ativoTotal: number;
  patrimonioLiquido: number;
  caixaOperacional: number;
  sourceUrl: string;
  fetchedAt: string;
  /** YoY — já convertido para reais. Ausente quando a CVM não oferece o comparativo (4º trimestre). */
  receitaMesmoTrimestreAnoAnterior?: number;
}

export interface DocumentoFinal extends IndicadorTrimestral {
  paragraph: string;
}

/** Linha crua de um CSV da CVM, indexada pelo cabeçalho original. */
export type LinhaCvm = Record<string, string>;
