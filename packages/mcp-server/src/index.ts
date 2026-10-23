// Superfície de biblioteca: só exporta, nunca liga transporte nem lê variável de ambiente.
// Quem compõe o servidor de verdade são os pontos de entrada (stdio.ts, http.ts) e a API.
export { mcpHttpPlugin } from './http-plugin.js';
export {
  criarMcpServer,
  DESCRICAO_PERGUNTAR,
  MENSAGEM_ERRO_GENERICA,
  type GetGraph,
  type GraphLike,
  type McpServerOptions,
} from './server.js';
