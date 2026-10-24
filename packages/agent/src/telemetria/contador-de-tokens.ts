import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { Serialized } from '@langchain/core/load/serializable';
import { AIMessage, type BaseMessage } from '@langchain/core/messages';
import type { ChatGeneration, LLMResult } from '@langchain/core/outputs';

// Tokens de uma chamada de LLM, já com o modelo que respondeu.
export interface UsoDeTokens {
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
}

const MODELO_DESCONHECIDO = 'desconhecido';

// Callback do LangChain que lê o usage_metadata real de cada chamada de chat. O início e o
// fim de uma chamada chegam em eventos separados, ligados pelo runId: o início diz o modelo,
// o fim diz os tokens. Quem recebe o uso (orçamento, métricas) não sabe que LangChain existe.
export class ContadorDeTokens extends BaseCallbackHandler {
  name = 'contador-de-tokens';
  private readonly modeloPorRun = new Map<string, string>();

  constructor(private readonly aoUsar: (uso: UsoDeTokens) => void) {
    super();
  }

  override handleChatModelStart(
    _llm: Serialized,
    _messages: BaseMessage[][],
    runId: string,
    _parentRunId?: string,
    _extraParams?: Record<string, unknown>,
    _tags?: string[],
    metadata?: Record<string, unknown>,
  ): void {
    // O LangChain põe o nome do modelo em ls_model_name para toda integração de chat.
    const modelo = metadata?.ls_model_name;
    this.modeloPorRun.set(runId, typeof modelo === 'string' ? modelo : MODELO_DESCONHECIDO);
  }

  override handleLLMEnd(output: LLMResult, runId: string): void {
    const modelo = this.modeloPorRun.get(runId) ?? MODELO_DESCONHECIDO;
    this.modeloPorRun.delete(runId);

    for (const geracoes of output.generations) {
      for (const geracao of geracoes) {
        // Só a mensagem de resposta do modelo (AIMessage) carrega o usage_metadata.
        const mensagem = (geracao as Partial<ChatGeneration>).message;
        const uso = AIMessage.isInstance(mensagem) ? mensagem.usage_metadata : undefined;
        if (uso) {
          this.aoUsar({ modelo, tokensEntrada: uso.input_tokens, tokensSaida: uso.output_tokens });
        }
      }
    }
  }
}

// Um contador novo por pergunta: o mapa de runIds não cresce entre requisições.
export function criarContadorDeTokens(aoUsar: (uso: UsoDeTokens) => void): ContadorDeTokens {
  return new ContadorDeTokens(aoUsar);
}
