// Superfície de biblioteca: só exporta, nunca liga transporte nem lê variável de ambiente.
// Quem compõe o servidor de verdade são os pontos de entrada (stdio.ts) e a API.
export {
  criarMcpServer,
  DESCRICAO_PERGUNTAR,
  MENSAGEM_ERRO_GENERICA,
  type GetGraph,
  type GraphLike,
  type McpServerOptions,
} from './server.js';
