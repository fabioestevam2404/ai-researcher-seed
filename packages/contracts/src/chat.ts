import { z } from 'zod';

export const chatRequestSchema = z.object({
  question: z.string().trim().min(1, 'A pergunta não pode ser vazia.').max(1000),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

// Resumo de um documento recuperado, do jeito que o painel do grafo mostra: de onde veio,
// o rótulo da citação e quão próximo estava da pergunta. O texto completo não trafega.
export const documentoResumoSchema = z.object({
  origem: z.enum(['cvm', 'web']),
  rotulo: z.string(),
  sourceUrl: z.string(),
  similaridade: z.number(),
});

export type DocumentoResumo = z.infer<typeof documentoResumoSchema>;

// Um evento por nó concluído do grafo (não por token). durationMs é medido no servidor,
// entre o fim do nó anterior e o fim deste.
const etapa = { durationMs: z.number().nonnegative() };

export const chatEventSchema = z.discriminatedUnion('node', [
  z.object({ node: z.literal('retrieve'), ...etapa, documents: z.array(documentoResumoSchema) }),
  z.object({
    node: z.literal('grade'),
    ...etapa,
    sufficient: z.boolean(),
    missingAspects: z.array(z.string()),
    iterations: z.number().int(),
    // O grade pediu consulta estruturada aos indicadores (pergunta agregada ou comparativa):
    // o próximo nó é o queryIndicators, não a busca web. Opcional: clientes antigos ignoram.
    consultaEstruturada: z.boolean().optional(),
  }),
  z.object({ node: z.literal('webSearch'), ...etapa }),
  // Linhas lidas direto das colunas de indicadores, uma por empresa e trimestre.
  z.object({
    node: z.literal('queryIndicators'),
    ...etapa,
    documents: z.array(documentoResumoSchema),
  }),
  z.object({ node: z.literal('answer'), ...etapa, answer: z.string() }),
  z.object({ node: z.literal('error'), message: z.string() }),
]);

export type ChatEvent = z.infer<typeof chatEventSchema>;
