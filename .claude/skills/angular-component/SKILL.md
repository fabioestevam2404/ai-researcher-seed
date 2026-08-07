---
name: angular-component
description: Use ao criar ou modificar componentes, serviços ou estado no frontend Angular deste projeto (apps/web). Complementa a skill oficial angular-developer com as convenções específicas do AI Researcher — store de chat, consumo de SSE, painel do grafo e disclaimer regulatório.
---

# Angular no AI Researcher

## Antes de tudo: use a skill oficial

Idiomas do framework — signals, `linkedSignal`, `resource`, formulários, injeção de dependência, roteamento, SSR, acessibilidade, testes, CLI — vêm da skill oficial **`angular-developer`**, mantida pelo time do Angular e atualizada a cada release.

```bash
npx skills add https://github.com/angular/skills
```

Este arquivo **não repete** o que a skill oficial cobre. Ele descreve apenas o que é específico deste projeto. Em caso de conflito entre os dois, a skill oficial vence — ela acompanha a versão do framework, este arquivo não.

Para criar o app do zero, use a skill oficial `angular-new-app`.

---

## Convenções deste projeto

### Estrutura

```
apps/web/src/app/
  chat/          componentes da conversa
  graph/         painel de estado do grafo
  state/         stores (um por domínio)
  api/           serviços de rede
```

### Componente não conhece HTTP

Toda chamada de rede vive em `api/`. O componente lê signals de um store e emite intenções. Se um componente importa `HttpClient`, está errado.

### Um store por domínio

Serviço `providedIn: 'root'`, signals privados graváveis e exposição pública somente leitura.

```ts
@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly _steps = signal<GraphStep[]>([]);
  readonly steps = this._steps.asReadonly();

  readonly currentStep = computed(() => this._steps().at(-1)?.name ?? null);

  appendStep(step: GraphStep) {
    this._steps.update((current) => [...current, step]);
  }
}
```

### Streaming SSE

A resposta do agente chega por `text/event-stream`. O serviço de API traduz cada evento em atualização de signal; o componente nunca conhece o protocolo.

Fechar a conexão ao destruir é obrigatório — conexão SSE vazada mantém instância viva no Cloud Run e aparece na conta. Use `DestroyRef`.

Os eventos do stream seguem os schemas de `packages/contracts`. Não invente um tipo local para o payload; importe do pacote compartilhado, senão a divergência entre API e front não quebra o build.

### Painel do grafo

O painel que mostra `retrieve → grade → webSearch → answer` é conteúdo pedagógico, não enfeite. Ele precisa refletir a transição em tempo real, com o nó ativo destacado e a duração de cada etapa visível ao fim.

Não colapse etapas nem esconda o loop: quando o grafo volta ao `retrieve` numa segunda iteração, isso tem que aparecer na tela.

### Citações

Toda resposta traz fonte e data-base. A citação é clicável, abre a fonte original e exibe o período do dado — sem o período, o número perde sentido para o usuário.

### Disclaimer regulatório

O aviso de que o sistema é informativo e não recomendatório fica permanentemente visível no layout principal. Não é modal, não é dispensável, e não desaparece durante o streaming.

---

## Nota para a gravação

Nas aulas, a instalação das skills oficiais do Angular é demonstrada explicitamente — é exemplo de skill mantida por terceiro, em contraste com as skills próprias do repositório (`fastify-route`, `langgraph-node` e esta). A distinção entre as duas origens é conteúdo da Unidade 1.
