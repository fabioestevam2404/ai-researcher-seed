import { sql } from 'drizzle-orm';
import type { Db } from './client.js';
import { documentos } from './schema.js';
import type { DocumentoComEmbedding } from '../seed/seed.js';

// Upsert pela chave de negócio (ticker, period): rodar o seed duas vezes atualiza os
// mesmos registros em vez de duplicá-los. `excluded` é a linha que tentou entrar.
export function criarUpsertDocumentos(db: Db) {
  return async (lote: DocumentoComEmbedding[]): Promise<void> => {
    await db
      .insert(documentos)
      .values(
        lote.map((doc) => ({
          ticker: doc.ticker,
          companyName: doc.companyName,
          setor: doc.setor,
          period: doc.period,
          periodEnd: doc.periodEnd,
          receitaLiquida: doc.receitaLiquida,
          lucroBruto: doc.lucroBruto,
          lucroLiquido: doc.lucroLiquido,
          ativoTotal: doc.ativoTotal,
          patrimonioLiquido: doc.patrimonioLiquido,
          caixaOperacional: doc.caixaOperacional,
          sourceUrl: doc.sourceUrl,
          fetchedAt: new Date(doc.fetchedAt),
          paragraph: doc.paragraph,
          embedding: doc.embedding,
        })),
      )
      .onConflictDoUpdate({
        target: [documentos.ticker, documentos.period],
        set: {
          companyName: sql`excluded.company_name`,
          setor: sql`excluded.setor`,
          periodEnd: sql`excluded.period_end`,
          receitaLiquida: sql`excluded.receita_liquida`,
          lucroBruto: sql`excluded.lucro_bruto`,
          lucroLiquido: sql`excluded.lucro_liquido`,
          ativoTotal: sql`excluded.ativo_total`,
          patrimonioLiquido: sql`excluded.patrimonio_liquido`,
          caixaOperacional: sql`excluded.caixa_operacional`,
          sourceUrl: sql`excluded.source_url`,
          fetchedAt: sql`excluded.fetched_at`,
          paragraph: sql`excluded.paragraph`,
          embedding: sql`excluded.embedding`,
        },
      });
  };
}
