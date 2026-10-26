import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { Consulta } from './consulta.js';
import type { ConsultarIndicadores } from './db/consultar-indicadores.js';
import type { BuscarDocumentosSimilares } from './db/retrieve-similar.js';
import type { InserirDocumentosWeb } from './db/inserir-documentos-web.js';
import type { DocumentoRecuperado } from './documento.js';
import { makeAnswerNode } from './nodes/answer.js';
import { makeGradeNode } from './nodes/grade.js';
import { makeQueryIndicatorsNode } from './nodes/query-indicators.js';
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
  // Pedido de consulta estruturada que o grade produz e o queryIndicators atende (RF-13).
  consulta: Annotation<Consulta | null>({
    reducer: (_anterior, novo) => novo,
    default: () => null,
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
  consultarIndicadores: ConsultarIndicadores;
}

// A regra de negócio do loop vive aqui, na aresta — os nós só produzem os dados. Estourar
// o limite não é erro: é resposta com contexto parcial, que o answer avisa ao usuário.
// Pergunta agregada ou comparativa (o grade pediu consulta) vai para os dados exatos do
// banco, não para a web: a web não traz indicador de 20 empresas.
export function decidirAposGrade(
  state: ResearchStateType,
): 'webSearch' | 'queryIndicators' | 'answer' {
  if (state.sufficient) return 'answer';
  if (state.consulta) return 'queryIndicators';
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
    .addNode('queryIndicators', makeQueryIndicatorsNode({ consultar: deps.consultarIndicadores }))
    .addNode('answer', makeAnswerNode(deps.answerLlm))
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'grade')
    .addConditionalEdges('grade', decidirAposGrade, ['webSearch', 'queryIndicators', 'answer'])
    .addEdge('webSearch', 'retrieve')
    .addEdge('queryIndicators', 'answer')
    .addEdge('answer', END)
    .compile();
}
