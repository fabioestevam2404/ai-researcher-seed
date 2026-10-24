import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import type { BuscarDocumentosSimilares } from '../db/retrieve-similar.js';
import type { InserirDocumentosWeb } from '../db/inserir-documentos-web.js';
import { EMBEDDING_DIMENSIONS } from '../db/schema.js';
import type { DocumentoCvm } from '../documento.js';

// Modo demo do grafo inteiro: sem Vertex AI, sem Postgres, sem rede. Serve para o E2E e para
// gravar aula sem depender de serviço externo. O caminho é sempre o mesmo — retrieve → grade
// → answer — e a resposta também.

// Documento real do corpus (packages/corpus/data/documentos/VALE.json, 3T25), congelado aqui.
// Se o corpus for recoletado com outros números, este continua igual: é uma fixture.
export const DOCUMENTO_VALE_3T25: DocumentoCvm = {
  origem: 'cvm',
  ticker: 'VALE',
  companyName: 'Vale S.A.',
  period: '3T25',
  periodEnd: '2025-09-30',
  content:
    'No 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões, alta de 7,0% frente ao 3T24 e alta de 13,8% frente ao 2T25. O lucro líquido foi de R$ 14,7 bilhões, com margem líquida de 25,9%. O caixa gerado nas operações somou R$ 13,7 bilhões.',
  sourceUrl: 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip',
  similaridade: 1,
};

// A resposta fixa se apresenta como demonstração: qualquer pergunta recebe este texto.
export const RESPOSTA_DEMO =
  'Modo demonstração: no 3T25, a Vale S.A. reportou receita líquida de R$ 56,7 bilhões, alta de 7,0% frente ao 3T24.';

// Vetor de zeros no tamanho da coluna: nada é comparado, a busca demo ignora o vetor.
export const demoEmbeddings: EmbeddingsInterface = {
  embedQuery: async () => new Array<number>(EMBEDDING_DIMENSIONS).fill(0),
  embedDocuments: async (textos) =>
    textos.map(() => new Array<number>(EMBEDDING_DIMENSIONS).fill(0)),
};

export const demoBuscar: BuscarDocumentosSimilares = async () => [DOCUMENTO_VALE_3T25];

// O grade demo nunca manda para a web, mas, se mandasse, nada seria gravado no banco.
export const demoInserirDocumentosWeb: InserirDocumentosWeb = async () => {};

// Os mesmos modelos falsos dos testes do grafo: devolvem sempre o texto da lista. O grade
// devolve o JSON que o withStructuredOutput espera.
export function criarDemoGradeLlm(): FakeListChatModel {
  return new FakeListChatModel({
    responses: [JSON.stringify({ sufficient: true, missingAspects: [] })],
  });
}

export function criarDemoAnswerLlm(): FakeListChatModel {
  return new FakeListChatModel({ responses: [RESPOSTA_DEMO] });
}
