import {
  bigint,
  date,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from 'drizzle-orm/pg-core';

// O Vertex AI gera 3.072 dimensões por padrão, mas o índice HNSW do pgvector aceita no
// máximo 2.000. Por isso a carga e a busca pedem 768 dimensões ao modelo — os dois lados
// precisam usar o mesmo modelo e a mesma dimensão, senão a busca não encontra nada.
export const EMBEDDING_DIMENSIONS = 768;

// Um documento por empresa e trimestre, vindo do corpus da CVM (packages/corpus).
export const documentos = pgTable(
  'documentos',
  {
    id: serial('id').primaryKey(),
    ticker: text('ticker').notNull(),
    companyName: text('company_name').notNull(),
    setor: text('setor').notNull(),
    period: text('period').notNull(),
    periodEnd: date('period_end').notNull(),

    // Valores em reais (a normalização já converteu de milhares). Nulo significa
    // "a CVM não informou", nunca zero.
    receitaLiquida: bigint('receita_liquida', { mode: 'number' }),
    lucroBruto: bigint('lucro_bruto', { mode: 'number' }),
    lucroLiquido: bigint('lucro_liquido', { mode: 'number' }),
    ativoTotal: bigint('ativo_total', { mode: 'number' }),
    patrimonioLiquido: bigint('patrimonio_liquido', { mode: 'number' }),
    caixaOperacional: bigint('caixa_operacional', { mode: 'number' }),

    sourceUrl: text('source_url').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    paragraph: text('paragraph').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  },
  (table) => [
    // Chave de negócio: rodar o seed de novo atualiza em vez de duplicar.
    uniqueIndex('documentos_ticker_period_idx').on(table.ticker, table.period),
    // HNSW é aproximado: troca um pouco de precisão por velocidade. O operador precisa
    // ser o mesmo da consulta — aqui, distância de cosseno.
    index('documentos_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
);
