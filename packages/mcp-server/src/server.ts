import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { chatRequestSchema } from '@hero/contracts';

// O servidor não importa os tipos do LangGraph: recebe o grafo por esta interface mínima, só
// com o método que a tool usa. No teste, um grafo fake cumpre o mesmo contrato.
export interface GraphLike {
  invoke(
    input: { question: string },
    options?: { callbacks?: object[] },
  ): Promise<{ answerText: string }>;
}

export type GetGraph = () => Promise<GraphLike>;

export interface McpServerOptions {
  getGraph: GetGraph;
  // Para onde vai o detalhe do erro. No stdio, stdout é o canal do protocolo — log só no stderr.
  logErro?: (error: unknown) => void;
  // Callbacks novas a cada chamada (Langfuse; na API, também o contador de tokens).
  criarCallbacks?: () => object[];
}

// A descrição é o que o agente cliente lê para decidir quando chamar a tool. Ela diz o que
// a base cobre, o que acontece quando não cobre e o que a tool nunca faz.
export const DESCRICAO_PERGUNTAR = [
  'Responde perguntas sobre indicadores financeiros de 20 empresas da B3, com dados oficiais',
  'da CVM (formulários ITR e DFP, últimos 4 trimestres): receita líquida, lucro bruto, lucro',
  'líquido, ativo total, patrimônio líquido e caixa operacional.',
  'Quando a base não basta (motivos, fatos relevantes, notícias), complementa com busca na web.',
  'Toda resposta cita a fonte e o período do dado.',
  'Nunca recomenda compra, venda ou manutenção de ativos: é informação, não consultoria.',
].join(' ');

export const MENSAGEM_ERRO_GENERICA =
  'Não foi possível concluir a pesquisa. Tente novamente em instantes.';

export function criarMcpServer({
  getGraph,
  logErro = console.error,
  criarCallbacks = () => [],
}: McpServerOptions) {
  const server = new McpServer({ name: 'ai-researcher', version: '0.0.0' });

  server.registerTool(
    'perguntar',
    {
      title: 'Perguntar ao AI Researcher',
      description: DESCRICAO_PERGUNTAR,
      // Mesma regra de validação da pergunta do /api/chat, vinda do pacote de contratos.
      inputSchema: { pergunta: chatRequestSchema.shape.question },
    },
    async ({ pergunta }) => {
      try {
        const graph = await getGraph();
        const { answerText } = await graph.invoke(
          { question: pergunta },
          { callbacks: criarCallbacks() },
        );
        return { content: [{ type: 'text', text: answerText }] };
      } catch (error) {
        // Mesma política do /api/chat: o detalhe vai para o log, o cliente recebe só o genérico.
        logErro(error);
        return { isError: true, content: [{ type: 'text', text: MENSAGEM_ERRO_GENERICA }] };
      }
    },
  );

  return server;
}
