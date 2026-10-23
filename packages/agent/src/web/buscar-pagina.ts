export const TIMEOUT_PAGINA_MS = 10_000;

export type BuscarPagina = (url: string) => Promise<string>;

// Baixa o HTML de uma página. Por padrão o fetch não tem timeout — uma página lenta
// travaria o nó inteiro; aqui ela desiste em 10 segundos e lança erro.
export const buscarPagina: BuscarPagina = async (url) => {
  const resposta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_PAGINA_MS) });

  if (!resposta.ok) {
    throw new Error(`Página ${url} respondeu HTTP ${resposta.status}`);
  }

  return resposta.text();
};
