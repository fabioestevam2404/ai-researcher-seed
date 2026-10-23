import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { formatarResposta } from '../answer/format-resposta.js';
import type { DocumentoRecuperado } from '../documento.js';
import { answerPrompt } from '../prompts/answer.js';

export function makeAnswerNode(llm: BaseChatModel) {
  return async (state: {
    question: string;
    documents: DocumentoRecuperado[];
    sufficient: boolean;
  }): Promise<{ answerText: string }> => {
    const resposta = await llm.invoke(answerPrompt(state));

    // O texto do modelo nunca sai daqui sem passar pelo filtro determinístico.
    return { answerText: formatarResposta(resposta.text, state.documents) };
  };
}
