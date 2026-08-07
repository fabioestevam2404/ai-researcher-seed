---
name: langgraph-node
description: Use ao criar ou modificar nós, arestas ou estado do grafo do agente em packages/agent. Cobre assinatura de nó, formato do estado, arestas condicionais, guard de iteração e testabilidade com LLM fake.
---

# Nós do grafo LangGraph

O grafo é o coração didático do projeto. Ele precisa ser legível em slide, rastreável no Langfuse e testável sem chamar LLM de verdade.

```
retrieve → grade → [suficiente]   → answer
                 → [insuficiente] → webSearch → upsert → (volta a retrieve, máx. 2)
```

## Regras

1. **Um nó por arquivo**, em `packages/agent/src/nodes/`. Nome de verbo.
2. **Nó é função pura de estado.** Recebe o estado, devolve um `Partial` do estado. Não escreve em variável externa, não chama `console.log`.
3. **Nó nunca decide rota.** A decisão vive na aresta condicional; o nó apenas produz o dado que a alimenta.
4. **Todo nó que chama LLM ou rede recebe a dependência por parâmetro**, nunca importa um cliente global. É o que torna o teste possível.
5. **Saída de LLM que alimenta decisão é estruturada e validada com zod.** Nunca faça parsing de texto livre para decidir rota.
6. **O contador de iteração é incrementado no nó, e verificado na aresta.** Sem guard, o grafo entra em laço.
7. **Prompts ficam em arquivos separados**, em `packages/agent/src/prompts/`, não embutidos no código do nó.

## Estado

Campo novo só entra no estado se mais de um nó o utiliza. Estado é contrato entre nós, não gaveta.

```ts
import { Annotation } from '@langchain/langgraph';

export const ResearchState = Annotation.Root({
  question: Annotation<string>,
  documents: Annotation<RetrievedDoc[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  sufficient: Annotation<boolean>,
  missingAspects: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  iterations: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
});
```

## Exemplo correto

```ts
import { z } from 'zod';
import { gradePrompt } from '../prompts/grade';

const gradeResult = z.object({
  sufficient: z.boolean(),
  missingAspects: z.array(z.string()),
});

export function makeGradeNode(llm: BaseChatModel) {
  return async (state: typeof ResearchState.State) => {
    const structured = llm.withStructuredOutput(gradeResult);

    const result = await structured.invoke(
      gradePrompt({ question: state.question, documents: state.documents }),
    );

    return {
      sufficient: result.sufficient,
      missingAspects: result.missingAspects,
      iterations: 1,
    };
  };
}
```

A aresta consome o resultado, sem reavaliar nada:

```ts
graph.addConditionalEdges('grade', (state) => {
  if (state.sufficient) return 'answer';
  if (state.iterations >= MAX_ITERATIONS) return 'answer';
  return 'webSearch';
});
```

Quando o limite é atingido, o caminho é `answer` — e a resposta informa que o contexto é parcial. Estourar iteração não é erro; é resposta com menos confiança.

## Exemplo incorreto

```ts
// Cliente global, decisão dentro do nó, parsing de texto livre
import { llm } from '../llm';

export async function grade(state) {
  const text = await llm.invoke(`Os documentos bastam? ${state.documents}`);

  if (text.includes('sim')) {
    return await answer(state);      // nó chamando nó
  }
  return await webSearch(state);
}
```

Quatro problemas: dependência global impede teste, o nó chama outro nó em vez de devolver estado, a decisão nasce de `includes` sobre texto livre, e não há contagem de iteração.

## Testes

Roteamento se testa com LLM fake, sem rede:

```ts
const fakeLlm = new FakeStructuredLLM({ sufficient: false, missingAspects: ['notícia recente'] });
const graph = buildGraph({ llm: fakeLlm, search: fakeSearch });

const trace = await runAndCollectNodes(graph, { question: '...' });

expect(trace).toContain('webSearch');
```

Todo nó novo entra no grafo junto com pelo menos um teste de roteamento.

## Modelo por nó

Cada nó que chama LLM recebe o cliente já configurado, e o modelo vem de variável de ambiente — nunca do código do nó.

```
MODEL_GRADE=gemini-3.5-flash-lite
MODEL_ANSWER=gemini-3.6-flash
```

`grade` roda em toda iteração e faz classificação simples: modelo mais barato. `answer` roda uma vez e precisa acertar citação e guardrail: modelo mais capaz. Se um nó novo chamar LLM, ele ganha a própria variável.

Apenas modelos estáveis. Preview é descontinuado com duas semanas de aviso.

## Observabilidade

Cada nó é um span no Langfuse, com custo e latência próprios. Ao criar um nó, verifique que ele aparece nomeado no trace — se o nome sumir, a aula perde a visualização que justifica o LangGraph.
