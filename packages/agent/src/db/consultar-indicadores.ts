import { and, asc, inArray } from 'drizzle-orm';
import type { Consulta, Indicador } from '../consulta.js';
import type { DocumentoCvm } from '../documento.js';
import type { Db } from './client.js';
import { documentos } from './schema.js';

export type ConsultarIndicadores = (consulta: Consulta) => Promise<DocumentoCvm[]>;

const NOME_DO_INDICADOR: Record<Indicador, string> = {
  receita_liquida: 'receita líquida',
  lucro_bruto: 'lucro bruto',
  lucro_liquido: 'lucro líquido',
  ativo_total: 'ativo total',
  patrimonio_liquido: 'patrimônio líquido',
  caixa_operacional: 'caixa gerado nas operações',
};

const UMA_CASA = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// Mesmo formato de moeda do parágrafo do corpus (packages/corpus/src/paragraphs/template.ts),
// para a resposta citar o valor igual nos dois caminhos.
export function formatarMoeda(valor: number): string {
  if (Math.abs(valor) >= 1_000_000_000)
    return `R$ ${UMA_CASA.format(valor / 1_000_000_000)} bilhões`;
  return `R$ ${UMA_CASA.format(valor / 1_000_000)} milhões`;
}

export interface LinhaDeIndicadores {
  ticker: string;
  companyName: string;
  period: string;
  periodEnd: string;
  sourceUrl: string;
  valores: Partial<Record<Indicador, number | null>>;
}

// Uma linha do banco vira um documento curto e citável: só os indicadores pedidos, com empresa,
// período e data-base. Indicador ausente aparece como "não informado", nunca como zero.
export function linhaParaDocumento(
  linha: LinhaDeIndicadores,
  indicadores: Indicador[],
): DocumentoCvm {
  const partes = indicadores.map((indicador) => {
    const valor = linha.valores[indicador];
    return `${NOME_DO_INDICADOR[indicador]} ${valor === null || valor === undefined ? 'não informado' : formatarMoeda(valor)}`;
  });

  return {
    origem: 'cvm',
    ticker: linha.ticker,
    companyName: linha.companyName,
    period: linha.period,
    periodEnd: linha.periodEnd,
    content: `No ${linha.period}, a ${linha.companyName}: ${partes.join('; ')}.`,
    sourceUrl: linha.sourceUrl,
    // Não houve busca por similaridade: o dado veio exato das colunas.
    similaridade: 1,
  };
}

// Leitura direta das colunas de indicadores, sem embedding. Lista vazia de tickers ou de
// períodos = sem filtro. Ordem estável (empresa, depois trimestre) para o answer comparar.
export function criarConsultarIndicadores(db: Db): ConsultarIndicadores {
  return async (consulta) => {
    const filtros = [
      consulta.tickers.length > 0
        ? inArray(
            documentos.ticker,
            consulta.tickers.map((t) => t.toUpperCase()),
          )
        : undefined,
      consulta.periodos.length > 0
        ? inArray(
            documentos.period,
            consulta.periodos.map((p) => p.toUpperCase()),
          )
        : undefined,
    ];

    const linhas = await db
      .select({
        ticker: documentos.ticker,
        companyName: documentos.companyName,
        period: documentos.period,
        periodEnd: documentos.periodEnd,
        sourceUrl: documentos.sourceUrl,
        receita_liquida: documentos.receitaLiquida,
        lucro_bruto: documentos.lucroBruto,
        lucro_liquido: documentos.lucroLiquido,
        ativo_total: documentos.ativoTotal,
        patrimonio_liquido: documentos.patrimonioLiquido,
        caixa_operacional: documentos.caixaOperacional,
      })
      .from(documentos)
      .where(and(...filtros))
      .orderBy(asc(documentos.ticker), asc(documentos.periodEnd));

    return linhas.map(({ ticker, companyName, period, periodEnd, sourceUrl, ...valores }) =>
      linhaParaDocumento(
        { ticker, companyName, period, periodEnd, sourceUrl, valores },
        consulta.indicadores,
      ),
    );
  };
}
