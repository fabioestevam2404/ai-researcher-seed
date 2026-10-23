import { describe, expect, it } from 'vitest';
import { CircuitoAbertoError } from '@hero/agent';
import { problemSchema } from '@hero/contracts';
import { build } from './app.js';

// App de teste com rotas que só lançam erro: exercita o tratamento central sem grafo nem banco.
function appQueLanca(erro: unknown) {
  const app = build({ checkDatabase: async () => true });
  app.get('/teste/erro', async () => {
    throw erro;
  });
  return app;
}

function esperarProblema(response: { headers: Record<string, unknown>; body: string }) {
  expect(response.headers['content-type']).toContain('application/problem+json');
  const problema = problemSchema.parse(JSON.parse(response.body));
  return problema;
}

describe('tratamento central de erros', () => {
  it('CA-08: corpo vazio com Content-Type JSON responde 400 em problem+json', async () => {
    const app = build();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { 'content-type': 'application/json' },
      payload: '',
    });

    expect(response.statusCode).toBe(400);
    expect(esperarProblema(response)).toMatchObject({ status: 400, title: 'Requisição inválida' });
  });

  it('JSON malformado responde 400 em problem+json', async () => {
    const app = build();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { 'content-type': 'application/json' },
      payload: '{"question":',
    });

    expect(response.statusCode).toBe(400);
    esperarProblema(response);
  });

  it('CA-09: rota inexistente responde 404 no mesmo formato', async () => {
    const app = build();

    const response = await app.inject({ method: 'GET', url: '/api/nao-existe' });

    expect(response.statusCode).toBe(404);
    expect(esperarProblema(response)).toMatchObject({ status: 404, title: 'Não encontrado' });
  });

  // Usa a classe real do agente: se ela for renomeada, o duck typing da API deixa de
  // reconhecê-la e este teste quebra — é o risco documentado no D-09.
  it('circuito aberto da busca web responde 503', async () => {
    const response = await appQueLanca(new CircuitoAbertoError()).inject({
      method: 'GET',
      url: '/teste/erro',
    });

    expect(response.statusCode).toBe(503);
    expect(esperarProblema(response)).toMatchObject({ status: 503 });
  });

  it('erro inesperado responde 500 genérico, sem mensagem nem stack interna', async () => {
    const response = await appQueLanca(new Error('senha do banco: hunter2')).inject({
      method: 'GET',
      url: '/teste/erro',
    });

    expect(response.statusCode).toBe(500);
    expect(esperarProblema(response)).toEqual({
      type: 'about:blank',
      title: 'Erro interno',
      status: 500,
    });
    expect(response.body).not.toContain('hunter2');
  });

  it('o que é lançado nem sempre é Error: um texto também vira 500 genérico', async () => {
    const response = await appQueLanca('falhou').inject({ method: 'GET', url: '/teste/erro' });

    expect(response.statusCode).toBe(500);
    esperarProblema(response);
  });
});
