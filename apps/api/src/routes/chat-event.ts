import type { ChatEvent, DocumentoResumo } from '@hero/contracts';

// A API não importa os tipos do LangGraph: recebe o grafo por esta interface mínima, só
// com o método que a rota usa. No teste, um grafo fake cumpre o mesmo contrato.
export interface GraphLike {
  stream(
    input: { question: string },
    // callbacks: os handlers do LangChain (contador de tokens) que acompanham esta execução.
    options: { streamMode: 'updates'; callbacks?: object[] },
  ): Promise<AsyncIterable<Record<string, unknown>>>;
}

export type GetGraph = () => Promise<GraphLike>;

// O update de cada nó chega como `unknown` — os campos são conferidos antes de virar evento.
function campo(update: unknown, nome: string): unknown {
  return typeof update === 'object' && update !== null
    ? (update as Record<string, unknown>)[nome]
    : undefined;
}

function resumirDocumento(doc: unknown): DocumentoResumo {
  const origem = campo(doc, 'origem') === 'web' ? 'web' : 'cvm';
  const rotulo =
    origem === 'web'
      ? String(campo(doc, 'title') ?? '')
      : `${String(campo(doc, 'ticker'))} · ${String(campo(doc, 'period'))}`;

  return {
    origem,
    rotulo,
    sourceUrl: String(campo(doc, 'sourceUrl') ?? ''),
    similaridade: Number(campo(doc, 'similaridade') ?? 0),
  };
}

// Traduz um passo do graph.stream() ({ [nomeDoNo]: update }) nos eventos que o frontend
// consome. Cada nó expõe só o que o painel de raciocínio precisa mostrar.
export function traduzirPasso(passo: Record<string, unknown>, durationMs: number): ChatEvent[] {
  return Object.entries(passo).flatMap(([node, update]): ChatEvent[] => {
    switch (node) {
      case 'retrieve': {
        const documents = campo(update, 'documents');
        return [
          {
            node,
            durationMs,
            documents: Array.isArray(documents) ? documents.map(resumirDocumento) : [],
          },
        ];
      }
      case 'grade': {
        const missingAspects = campo(update, 'missingAspects');
        return [
          {
            node,
            durationMs,
            sufficient: campo(update, 'sufficient') === true,
            missingAspects: Array.isArray(missingAspects) ? missingAspects.map(String) : [],
            iterations: Number(campo(update, 'iterations') ?? 0),
          },
        ];
      }
      case 'webSearch':
        // O webSearch não produz campo de estado novo: só o nome e a duração.
        return [{ node, durationMs }];
      case 'answer':
        return [{ node, durationMs, answer: String(campo(update, 'answerText') ?? '') }];
      default:
        return [];
    }
  });
}
