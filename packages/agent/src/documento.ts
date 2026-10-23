// O que o retrieve entrega aos outros nós: o texto que vai para o prompt, de onde ele
// veio (para a citação) e o quão próximo está da pergunta.
export interface DocumentoRecuperado {
  origem: 'cvm';
  ticker: string;
  companyName: string;
  period: string;
  /** Data-base do dado, ex.: "2025-09-30". */
  periodEnd: string;
  content: string;
  sourceUrl: string;
  /** 1 − distância de cosseno: quanto maior, mais próximo da pergunta. */
  similaridade: number;
}
