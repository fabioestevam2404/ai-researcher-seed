import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { mcpHttpPlugin, type GetGraph as GetMcpGraph } from '@hero/mcp-server';
import healthRoute from './routes/health.js';
import chatRoute from './routes/chat.js';
import type { GetGraph as GetChatGraph } from './routes/chat-event.js';
import { checkDatabase as defaultCheckDatabase } from './db.js';
import { registrarTratamentoDeErros } from './erros.js';
import { lerLimites, type Limites } from './limites.js';
import { criarMetricas, type Metricas, type UsoDeTokens } from './metricas.js';
import metricsRoute from './routes/metrics.js';
import { OrcamentoDiario } from './orcamento.js';

// Chat e MCP recebem o grafo por portas separadas, cada uma com a interface mínima que usa
// (stream no chat, invoke no MCP). Em produção as duas apontam para o mesmo getRealGraph.
export interface BuildOptions {
  checkDatabase?: () => Promise<boolean>;
  getChatGraph?: GetChatGraph;
  getMcpGraph?: GetMcpGraph;
  limites?: Limites;
  // Injetável para o teste começar com o orçamento já gasto.
  orcamento?: OrcamentoDiario;
  // Gateway /api/mcp desligado por padrão (plan.md §9, item 1): em produção o MCP fica só no
  // stdio e no servidor standalone local. Liga com MCP_GATEWAY=true.
  mcpGateway?: boolean;
  // Fábrica do contador de tokens (vem do agente, no index.ts). Sem ela, nada é contado.
  criarContadorDeTokens?: (aoUsar: (uso: UsoDeTokens) => void) => object;
  metricas?: Metricas;
}

// Sem grafo injetado, chat e MCP respondem com erro em vez de derrubar a API — o health
// continua funcionando mesmo se o agente não estiver configurado.
async function grafoNaoConfigurado(): Promise<never> {
  throw new Error('Grafo do agente não configurado (não foi passado para build()).');
}

// Health e métricas ficam fora do rate limit: são consultados por máquina (Cloud Run,
// capstone:check, Prometheus) e não custam nada de LLM.
function isentoDoRateLimit(url: string): boolean {
  return url.startsWith('/api/health') || url.startsWith('/api/metrics');
}

export function build({
  checkDatabase = defaultCheckDatabase,
  getChatGraph = grafoNaoConfigurado,
  getMcpGraph = grafoNaoConfigurado,
  limites = lerLimites(),
  orcamento = new OrcamentoDiario(limites.orcamentoDiarioTokens),
  mcpGateway = process.env.MCP_GATEWAY === 'true',
  criarContadorDeTokens,
  metricas = criarMetricas(),
}: BuildOptions = {}) {
  const app = Fastify({ logger: true });

  // Cada chamada de LLM conta duas vezes: no teto de gasto do dia e nos contadores do
  // Prometheus. Os dois partem do mesmo usage_metadata real.
  const aoUsar = (uso: UsoDeTokens) => {
    orcamento.registrar(uso.tokensEntrada + uso.tokensSaida);
    metricas.registrarUso(uso);
  };
  const criarCallbacks = () => (criarContadorDeTokens ? [criarContadorDeTokens(aoUsar)] : []);

  // Registrado na raiz antes das rotas: vale para todas elas, inclusive as de /api.
  registrarTratamentoDeErros(app);

  // Um balde só para todos os clientes. Atrás do Firebase Hosting e do Cloud Run, o IP de
  // quem pergunta chega num cabeçalho que o próprio cliente consegue forjar — limitar por IP
  // seria contornável. O teto de custo de verdade é o orçamento diário, também global.
  app.register(rateLimit, {
    max: limites.rateLimitMax,
    timeWindow: limites.rateLimitJanela,
    keyGenerator: () => 'global',
    allowList: (request) => isentoDoRateLimit(request.url),
  });

  app.register(
    async (api) => {
      api.register(healthRoute, { checkDatabase });
      api.register(chatRoute, { getGraph: getChatGraph, orcamento, criarCallbacks });
      api.register(metricsRoute, { registry: metricas.registry });
      // Gateway MCP: o mesmo plugin do servidor standalone, aqui em /api/mcp.
      if (mcpGateway) {
        api.register(mcpHttpPlugin, {
          getGraph: getMcpGraph,
          logErro: (error) => app.log.error(error, 'Falha na tool perguntar (MCP)'),
        });
      }
    },
    { prefix: '/api' },
  );

  return app;
}
