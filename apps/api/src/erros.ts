import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Problem } from '@hero/contracts';

function enviarProblema(reply: FastifyReply, problema: Problem) {
  return reply.code(problema.status).type('application/problem+json').send(problema);
}

// O erro chega como `unknown`: qualquer coisa pode ser lançada. Lê um campo sem confiar no tipo.
function campo(error: unknown, nome: string): unknown {
  return typeof error === 'object' && error !== null
    ? (error as Record<string, unknown>)[nome]
    : undefined;
}

// Erro → resposta. Os nomes são comparados como texto (duck typing): a API não importa as
// classes do zod nem do agente. Renomear CircuitoAbertoError lá quebra o 503 aqui — há teste.
function paraProblema(error: unknown): Problem {
  const nome = campo(error, 'name');

  if (nome === 'ZodError') {
    const issues = campo(error, 'issues');
    return {
      type: 'about:blank',
      title: 'Requisição inválida',
      status: 400,
      detail: Array.isArray(issues)
        ? issues.map((issue) => String(campo(issue, 'message'))).join('; ')
        : undefined,
    };
  }

  if (nome === 'OrcamentoEsgotadoError') {
    return {
      type: 'about:blank',
      title: 'Orçamento diário esgotado',
      status: 429,
      detail: 'O limite de uso de hoje foi atingido. Tente novamente amanhã.',
    };
  }

  if (nome === 'CircuitoAbertoError') {
    return {
      type: 'about:blank',
      title: 'Serviço temporariamente indisponível',
      status: 503,
      detail: 'A busca web está fora do ar. Tente novamente em instantes.',
    };
  }

  // Erros 4xx do próprio Fastify (JSON malformado, corpo vazio, tipo de conteúdo não aceito)
  // já vêm com status e mensagem segura para o cliente.
  const status = campo(error, 'statusCode');

  // Lançado pelo @fastify/rate-limit, que já pôs os cabeçalhos Retry-After e x-ratelimit-*.
  if (status === 429) {
    return {
      type: 'about:blank',
      title: 'Muitas requisições',
      status: 429,
      detail: 'Limite de requisições atingido. Aguarde um pouco e tente de novo.',
    };
  }

  if (typeof status === 'number' && status >= 400 && status < 500) {
    return {
      type: 'about:blank',
      title: 'Requisição inválida',
      status,
      detail: String(campo(error, 'message') ?? ''),
    };
  }

  // Todo o resto: 500 sem detalhe. Stack trace e mensagem interna ficam só no log.
  return { type: 'about:blank', title: 'Erro interno', status: 500 };
}

// Um único lugar decide o formato de todo erro da API, inclusive rota inexistente.
export function registrarTratamentoDeErros(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    const problema = paraProblema(error);
    // Orçamento esgotado diz quando renova (meia-noite UTC); o rate limit põe o próprio header.
    const segundosAteRenovar = campo(error, 'segundosAteRenovar');
    if (typeof segundosAteRenovar === 'number') {
      reply.header('Retry-After', String(segundosAteRenovar));
    }
    if (problema.status >= 500) {
      request.log.error(error, 'Erro não tratado na requisição');
    }
    return enviarProblema(reply, problema);
  });

  app.setNotFoundHandler((request, reply) =>
    enviarProblema(reply, {
      type: 'about:blank',
      title: 'Não encontrado',
      status: 404,
      detail: `Rota ${request.method} ${request.url} não existe.`,
    }),
  );
}
