---
name: fastify-route
description: Use ao criar ou modificar rotas HTTP na API Fastify (apps/api). Cobre validação com zod, tratamento de erro em problem+json, streaming SSE e organização em plugins.
---

# Rotas Fastify

## Estrutura

Uma rota por arquivo, registrada como plugin. O arquivo expõe um `FastifyPluginAsync` como default export.

```
apps/api/src/routes/
  health.ts
  chat.ts
```

A rota não contém regra de negócio. Ela valida entrada, chama um caso de uso de `packages/agent` e formata a saída.

## Regras

1. **Toda entrada é validada com zod**, importado de `packages/contracts`. Nunca confie no corpo da requisição.
2. **Erro de domínio nunca vaza como 500.** Classes de erro nomeadas são mapeadas para status HTTP no error handler central.
3. **Resposta de erro em `application/problem+json`**, com `type`, `title`, `status` e `detail`.
4. **Sem lógica assíncrona solta.** Toda chamada externa tem timeout explícito.
5. **Rotas de debug ficam atrás de flag** e nunca sobem em produção.

## Exemplo correto

```ts
import type { FastifyPluginAsync } from 'fastify';
import { chatRequestSchema } from '@hero/contracts';
import { runResearchGraph } from '@hero/agent';

const chatRoute: FastifyPluginAsync = async (app) => {
  app.post('/chat', async (request, reply) => {
    const body = chatRequestSchema.parse(request.body);

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    for await (const event of runResearchGraph(body)) {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    reply.raw.end();
  });
};

export default chatRoute;
```

`no-transform` é obrigatório: sem ele o streaming é bufferizado no Cloud Run e a resposta chega de uma vez.

## Exemplo incorreto

```ts
// Sem validação, com regra de negócio na rota e erro genérico
app.post('/chat', async (req, reply) => {
  const question = (req.body as any).question;

  const docs = await db.query('SELECT ...');
  if (docs.length < 3) {
    const web = await fetch(`https://api.serper.dev/search?q=${question}`);
    // ...
  }

  try {
    return await llm.invoke(question);
  } catch (e) {
    reply.code(500).send({ error: 'erro' });
  }
});
```

Quatro problemas: `any` no corpo, orquestração dentro da rota, chamada externa sem timeout, e erro sem tipo nem formato.

## Testes

Rota se testa com `app.inject()`, sem subir servidor. Dependências externas entram como fake pela injeção do caso de uso — nunca por mock de módulo.
