// Única definição do que liga o modo demo. Cada composição de dependência (busca, página e,
// na Fase 8, o resto do grafo) pergunta aqui — as implementações reais nunca leem DEMO.
export function modoDemo(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEMO === 'true';
}
