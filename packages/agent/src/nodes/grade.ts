import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { z } from 'zod';
import { consultaSchema, type Consulta } from '../consulta.js';
import type { DocumentoRecuperado } from '../documento.js';
import { gradePrompt } from '../prompts/grade.js';

// Saída estruturada: a decisão de rota nunca nasce de parsing de texto livre. "consulta" é
// opcional — só vem quando a pergunta pede indicadores de várias empresas ou trimestres (RF-13).
export const gradeResultSchema = z.object({
  sufficient: z.boolean(),
  missingAspects: z.array(z.string()),
  consulta: consultaSchema.optional(),
});

export interface GradeUpdate {
  sufficient: boolean;
  missingAspects: string[];
  /** Somado ao contador do estado (reducer); a aresta condicional usa para cortar o loop. */
  iterations: number;
  /** Pedido de consulta estruturada; a aresta manda para o queryIndicators. */
  consulta: Consulta | null;
}

export function makeGradeNode(llm: BaseChatModel) {
  const structured = llm.withStructuredOutput(gradeResultSchema, { name: 'avaliacao_contexto' });

  return async (state: {
    question: string;
    documents: DocumentoRecuperado[];
  }): Promise<GradeUpdate> => {
    // Sem documento não há o que avaliar: insuficiente sem gastar uma chamada de LLM.
    // missingAspects vazio faz o webSearch buscar a pergunta inteira.
    if (state.documents.length === 0) {
      return { sufficient: false, missingAspects: [], iterations: 1, consulta: null };
    }

    const resultado = gradeResultSchema.parse(await structured.invoke(gradePrompt(state)));

    return {
      sufficient: resultado.sufficient,
      missingAspects: resultado.sufficient ? [] : resultado.missingAspects,
      iterations: 1,
      // Contexto suficiente não precisa de consulta, mesmo que o modelo tenha mandado uma.
      consulta: resultado.sufficient ? null : (resultado.consulta ?? null),
    };
  };
}
