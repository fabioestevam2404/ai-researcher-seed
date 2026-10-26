import { z } from 'zod';

// Os seis indicadores do corpus, com o nome da coluna no banco. O grade escolhe entre eles.
export const INDICADORES = [
  'receita_liquida',
  'lucro_bruto',
  'lucro_liquido',
  'ativo_total',
  'patrimonio_liquido',
  'caixa_operacional',
] as const;

export type Indicador = (typeof INDICADORES)[number];

// Pedido de consulta estruturada (RF-13), produzido pelo grade quando a pergunta precisa de um
// indicador para várias empresas ou trimestres. Lista vazia = sem filtro (todas as empresas,
// todos os trimestres do corpus).
export const consultaSchema = z.object({
  indicadores: z.array(z.enum(INDICADORES)).min(1),
  tickers: z.array(z.string()),
  periodos: z.array(z.string()),
});

export type Consulta = z.infer<typeof consultaSchema>;
