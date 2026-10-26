import type { Consulta } from '../consulta.js';
import type { ConsultarIndicadores } from '../db/consultar-indicadores.js';
import type { DocumentoRecuperado } from '../documento.js';

// Atende o pedido de consulta estruturada do grade (RF-13): troca os documentos do contexto
// pelas linhas exatas das colunas de indicadores. Os dados são completos para o que foi pedido,
// então o contexto passa a ser suficiente — a menos que a consulta não ache nada.
export function makeQueryIndicatorsNode({ consultar }: { consultar: ConsultarIndicadores }) {
  return async (state: {
    consulta: Consulta | null;
  }): Promise<{ documents: DocumentoRecuperado[]; sufficient: boolean }> => {
    if (!state.consulta) return { documents: [], sufficient: false };

    const documents = await consultar(state.consulta);
    return { documents, sufficient: documents.length > 0 };
  };
}
