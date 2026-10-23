import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { BuscarDocumentosSimilares } from './db/retrieve-similar.js';
import type { InserirDocumentosWeb } from './db/inserir-documentos-web.js';
import type { DocumentoRecuperado } from './documento.js';
import { makeAnswerNode } from './nodes/answer.js';
import { makeGradeNode } from './nodes/grade.js';
import { makeRetrieveNode } from './nodes/retrieve.js';
import { makeWebSearchNode } from './nodes/web-search.js';
import type { SearchProvider } from './search/types.js';
import type { BuscarPagina } from './web/buscar-pagina.js';

// Passagens pelo grade, não chamadas à web. Sem este limite o agente ficaria buscando e
// gastando tokens para sempre numa pergunta que a web também não responde.
export const MAX_ITERATIONS = 2;

// O estado viaja de nó em nó. Cada nó devolve só o pedaço que mudou; os reducers dizem
// como esse pedaço entra no estado.
export const ResearchState = Annotation.Root({
  question: Annotation<string>,
  documents: Annotation<DocumentoRecuperado[]>({
    reducer: (_anterior, novo) => novo,
    default: () => [],
  }),
  sufficient: Annotation<boolean>({
    reducer: (_anterior, novo) => novo,
    default: () => false,
  }),
  missingAspects: Annotation<string[]>({
    reducer: (_anterior, novo) => novo,
    default: () => [],
  }),
  // Soma 1 a cada passada pelo grade. O contador mora no estado, sem variável externa.
  iterations: Annotation<number>({
    reducer: (anterior, novo) => anterior + novo,
    default: () => 0,
  }),
  // Não pode se chamar "answer": o LangGraph não aceita canal com o mesmo nome de um nó.
  answerText: Annotation<string>({
    reducer: (_anterior, novo) => novo,
    default: () => '',
  }),
});

export type ResearchStateType = typeof ResearchState.State;

// Dependências por função, não o cliente de banco: o grafo inteiro roda nos testes com
// fakes, sem Postgres, Vertex AI nem Serper.
export interface GraphDeps {
  embeddings: EmbeddingsInterface;
  buscar: BuscarDocumentosSimilares;
  gradeLlm: BaseChatModel;
  answerLlm: BaseChatModel;
  searchProvider: SearchProvider;
  buscarPagina: BuscarPagina;
  inserirDocumentosWeb: InserirDocumentosWeb;
}

// A regra de negócio do loop vive aqui, na aresta — os nós só produzem os dados. Estourar
// o limite não é erro: é resposta com contexto parcial, que o answer avisa ao usuário.
export function decidirAposGrade(state: ResearchStateType): 'webSearch' | 'answer' {
  if (state.sufficient) return 'answer';
  if (state.iterations >= MAX_ITERATIONS) return 'answer';
  return 'webSearch';
}

export function buildGraph(deps: GraphDeps) {
  return new StateGraph(ResearchState)
    .addNode('retrieve', makeRetrieveNode({ embeddings: deps.embeddings, buscar: deps.buscar }))
    .addNode('grade', makeGradeNode(deps.gradeLlm))
    .addNode(
      'webSearch',
      makeWebSearchNode({
        searchProvider: deps.searchProvider,
        buscarPagina: deps.buscarPagina,
        embeddings: deps.embeddings,
        inserirDocumentosWeb: deps.inserirDocumentosWeb,
      }),
    )
    .addNode('answer', makeAnswerNode(deps.answerLlm))
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'grade')
    .addConditionalEdges('grade', decidirAposGrade, ['webSearch', 'answer'])
    .addEdge('webSearch', 'retrieve')
    .addEdge('answer', END)
    .compile();
}
