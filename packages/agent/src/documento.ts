// O que o retrieve entrega aos outros nós: o texto que vai para o prompt, de onde ele
// veio (para a citação) e o quão próximo está da pergunta. A origem distingue a
// informação oficial e perene da CVM da informação da web, menos confiável e com validade.
interface DocumentoBase {
  content: string;
  sourceUrl: string;
  /** 1 − distância de cosseno: quanto maior, mais próximo da pergunta. */
  similaridade: number;
}

export interface DocumentoCvm extends DocumentoBase {
  origem: 'cvm';
  ticker: string;
  companyName: string;
  period: string;
  /** Data-base do dado, ex.: "2025-09-30". */
  periodEnd: string;
}

export interface DocumentoWeb extends DocumentoBase {
  origem: 'web';
  title: string;
  /** Quando a página foi coletada, em ISO 8601. */
  fetchedAt: string;
}

export type DocumentoRecuperado = DocumentoCvm | DocumentoWeb;
