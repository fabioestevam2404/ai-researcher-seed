import type { FastifyPluginAsync } from 'fastify';
import { chatRequestSchema, type ChatEvent } from '@hero/contracts';
import type { OrcamentoDiario } from '../orcamento.js';
import { traduzirPasso, type GetGraph } from './chat-event.js';

export interface ChatRouteOptions {
  getGraph: GetGraph;
  orcamento: OrcamentoDiario;
  // Callbacks novas a cada pergunta (contador de tokens que alimenta orçamento e métricas).
  criarCallbacks: () => object[];
}

function escreverEvento(raw: NodeJS.WritableStream, evento: ChatEvent) {
  raw.write(`data: ${JSON.stringify(evento)}\n\n`);
}

const chatRoute: FastifyPluginAsync<ChatRouteOptions> = async (
  app,
  { getGraph, orcamento, criarCallbacks },
) => {
  app.post('/chat', async (request, reply) => {
    // Corpo inválido lança ZodError, e o tratamento central de erros responde 400. Isso só
    // funciona porque acontece antes do hijack: depois dele, erro vira evento SSE.
    const { question } = chatRequestSchema.parse(request.body);

    // Orçamento do dia esgotado: 429 em problem+json antes do primeiro byte do stream —
    // nenhum token de LLM é gasto e o cliente recebe um status HTTP de verdade.
    orcamento.garantirDisponivel();

    // A partir daqui a resposta é um stream: o Fastify não escreve mais nada por nós.
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // Sem no-transform o Cloud Run bufferiza a resposta inteira e manda tudo no fim.
      'Cache-Control': 'no-cache, no-transform',
      // Mantém o túnel aberto enquanto o grafo trabalha.
      Connection: 'keep-alive',
    });

    let inicioEtapa = Date.now();
    // No streamMode 'updates' o grade devolve só o incremento (1), não o total que o reducer
    // soma no estado. O painel precisa do total, então a rota acumula como o reducer faria.
    let iteracoes = 0;
    try {
      const graph = await getGraph();
      // As callbacks entram aqui, no único call site do grafo: todos os nós e LLMs desta
      // pergunta passam por elas.
      const passos = await graph.stream(
        { question },
        { streamMode: 'updates', callbacks: criarCallbacks() },
      );

      for await (const passo of passos) {
        const agora = Date.now();
        for (const evento of traduzirPasso(passo, agora - inicioEtapa)) {
          if (evento.node === 'grade') {
            iteracoes += evento.iterations;
            escreverEvento(reply.raw, { ...evento, iterations: iteracoes });
          } else {
            escreverEvento(reply.raw, evento);
          }
        }
        inicioEtapa = agora;
      }
    } catch (error) {
      // Erro no meio do stream vira evento de erro; o processo nunca cai. O detalhe vai para
      // o log interno, não para o cliente.
      request.log.error(error, 'Falha ao executar o grafo do agente');
      escreverEvento(reply.raw, {
        node: 'error',
        message: 'Não foi possível concluir a pesquisa. Tente novamente em instantes.',
      });
    } finally {
      reply.raw.end();
    }
  });
};

export default chatRoute;
