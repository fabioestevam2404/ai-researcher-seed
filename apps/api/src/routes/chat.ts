import type { FastifyPluginAsync } from 'fastify';
import { chatRequestSchema, type ChatEvent } from '@hero/contracts';
import { traduzirPasso, type GetGraph } from './chat-event.js';

export interface ChatRouteOptions {
  getGraph: GetGraph;
}

function escreverEvento(raw: NodeJS.WritableStream, evento: ChatEvent) {
  raw.write(`data: ${JSON.stringify(evento)}\n\n`);
}

const chatRoute: FastifyPluginAsync<ChatRouteOptions> = async (app, { getGraph }) => {
  app.post('/chat', async (request, reply) => {
    const validacao = chatRequestSchema.safeParse(request.body);
    if (!validacao.success) {
      return reply
        .code(400)
        .type('application/problem+json')
        .send({
          type: 'about:blank',
          title: 'Requisição inválida',
          status: 400,
          detail: validacao.error.issues.map((issue) => issue.message).join('; '),
        });
    }

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
      const passos = await graph.stream(
        { question: validacao.data.question },
        { streamMode: 'updates' },
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
