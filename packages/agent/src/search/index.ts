import { makeGoogleCustomSearchProvider } from './google-custom-search.js';
import { makeSerperProvider } from './serper.js';
import type { SearchProvider } from './types.js';

export type { SearchProvider, SearchResult } from './types.js';
export { SearchProviderError } from './types.js';

function exigir(nome: string, env: NodeJS.ProcessEnv): string {
  const valor = env[nome];
  if (!valor) {
    throw new Error(`${nome} não definido. Configure no .env (local) ou no Secret Manager.`);
  }
  return valor;
}

// Único lugar que lê SEARCH_PROVIDER. Recebe o env por parâmetro para o teste não
// depender do ambiente da máquina.
export function criarSearchProvider(env: NodeJS.ProcessEnv = process.env): SearchProvider {
  const provider = env.SEARCH_PROVIDER ?? 'serper';

  switch (provider) {
    case 'serper':
      return makeSerperProvider(exigir('SERPER_API_KEY', env));
    case 'google':
      return makeGoogleCustomSearchProvider(
        exigir('GOOGLE_CSE_KEY', env),
        exigir('GOOGLE_CSE_CX', env),
      );
    default:
      throw new Error(`SEARCH_PROVIDER desconhecido: "${provider}". Use "serper" ou "google".`);
  }
}
