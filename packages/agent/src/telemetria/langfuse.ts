import { CallbackHandler } from '@langfuse/langchain';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';

// Langfuse é opcional: sem as duas chaves, nada é registrado e o processo sobe igual (RNF-05).
// As chaves e LANGFUSE_BASE_URL são lidas do ambiente pelo próprio SDK.
export function langfuseConfigurado(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);
}

let sdk: NodeSDK | undefined;

// Liga o OpenTelemetry com o exportador do Langfuse. Chamada uma vez no boot de cada processo
// que roda o grafo: a API e os dois transportes do MCP (stdio e HTTP standalone).
export function iniciarTelemetria(env: NodeJS.ProcessEnv = process.env): boolean {
  if (sdk) return true;
  if (!langfuseConfigurado(env)) return false;

  sdk = new NodeSDK({
    // "immediate": cada span sai assim que termina. No Cloud Run a CPU é reduzida depois da
    // resposta; um lote esperando para ser enviado poderia nunca sair.
    spanProcessors: [new LangfuseSpanProcessor({ exportMode: 'immediate' })],
  });
  sdk.start();

  // O Cloud Run manda SIGTERM antes de desligar a instância: dá tempo de enviar o que falta.
  process.once('SIGTERM', () => {
    void sdk?.shutdown();
  });
  return true;
}

// O CallbackHandler é o interceptor: acompanha cada nó e cada LLM da execução e vira um trace
// no Langfuse, com modelo, tokens e custo. Um novo por pergunta, passado no graph.stream().
export function criarCallbacksLangfuse(env: NodeJS.ProcessEnv = process.env): object[] {
  return langfuseConfigurado(env) ? [new CallbackHandler({ tags: ['ai-researcher'] })] : [];
}
