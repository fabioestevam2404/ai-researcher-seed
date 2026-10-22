import { z } from 'zod';

// Formato dos JSONs gerados por packages/corpus. Ler arquivo é fronteira do sistema,
// então validamos aqui em vez de confiar no tipo — um JSON editado à mão quebraria o seed
// com uma mensagem clara, e não com um erro de SQL lá na frente.
const valorEmReais = z.number().int().nullable();

export const documentoCorpusSchema = z.object({
  ticker: z.string().min(1),
  companyName: z.string().min(1),
  setor: z.string().min(1),
  period: z.string().regex(/^[1-4]T\d{2}$/, 'período no formato 3T25'),
  periodEnd: z.iso.date(),
  receitaLiquida: valorEmReais,
  lucroBruto: valorEmReais,
  lucroLiquido: valorEmReais,
  ativoTotal: valorEmReais,
  patrimonioLiquido: valorEmReais,
  caixaOperacional: valorEmReais,
  sourceUrl: z.url(),
  fetchedAt: z.iso.datetime(),
  paragraph: z.string().min(1),
});

export type DocumentoCorpus = z.infer<typeof documentoCorpusSchema>;

export const arquivoCorpusSchema = z.array(documentoCorpusSchema);
