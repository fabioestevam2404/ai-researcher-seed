import { describe, expect, it } from 'vitest';
import {
  CircuitoAbertoError,
  comResiliencia,
  FALHAS_PARA_ABRIR,
  RESFRIAMENTO_MS,
} from './com-resiliencia.js';
import { SearchProviderError, type SearchProvider, type SearchResult } from './types.js';

const RESULTADO: SearchResult[] = [{ title: 'ok', snippet: '', url: 'https://ex.com' }];

// Fornecedor fake que segue um roteiro: cada item é a resposta de uma chamada ('ok' ou o
// erro a lançar). Depois do roteiro, repete o último item.
function fornecedor(roteiro: Array<'ok' | Error>) {
  let chamadas = 0;
  const provider: SearchProvider = {
    async search() {
      const passo = roteiro[Math.min(chamadas, roteiro.length - 1)];
      chamadas += 1;
      if (passo instanceof Error) throw passo;
      return RESULTADO;
    },
  };
  return { provider, chamadas: () => chamadas };
}

// Relógio parado que o teste avança à mão, e uma espera que só registra quanto esperaria.
function montar(roteiro: Array<'ok' | Error>) {
  const fake = fornecedor(roteiro);
  let instante = 0;
  const esperas: number[] = [];
  const busca = comResiliencia(fake.provider, {
    agora: () => instante,
    esperar: async (ms) => {
      esperas.push(ms);
    },
  });
  return {
    busca,
    esperas,
    chamadas: fake.chamadas,
    avancar: (ms: number) => {
      instante += ms;
    },
  };
}

const foraDoAr = new SearchProviderError('Serper', 503);

describe('comResiliencia — retry', () => {
  it('tenta de novo com backoff exponencial e devolve quando uma tentativa dá certo', async () => {
    const { busca, esperas, chamadas } = montar([foraDoAr, new Error('timeout'), 'ok']);

    expect(await busca.search('Vale')).toEqual(RESULTADO);
    expect(chamadas()).toBe(3);
    expect(esperas).toEqual([500, 1000]);
  });

  it('desiste depois de 3 tentativas e repassa o erro original', async () => {
    const { busca, chamadas } = montar([foraDoAr]);

    await expect(busca.search('Vale')).rejects.toBe(foraDoAr);
    expect(chamadas()).toBe(3);
  });

  it('não repete erro que não passa sozinho (chave inválida)', async () => {
    const chaveInvalida = new SearchProviderError('Serper', 401);
    const { busca, chamadas } = montar([chaveInvalida]);

    await expect(busca.search('Vale')).rejects.toBe(chaveInvalida);
    expect(chamadas()).toBe(1);
  });

  it('429 (limite de requisições) vale nova tentativa', async () => {
    const { busca, chamadas } = montar([new SearchProviderError('Serper', 429), 'ok']);

    await busca.search('Vale');
    expect(chamadas()).toBe(2);
  });
});

describe('comResiliencia — circuit breaker', () => {
  async function falharAteAbrir(busca: SearchProvider) {
    for (let i = 0; i < FALHAS_PARA_ABRIR; i++) {
      await expect(busca.search('Vale')).rejects.toBe(foraDoAr);
    }
  }

  it('abre depois de 3 buscas falhas e passa a falhar na hora, sem chamar o fornecedor', async () => {
    const { busca, chamadas } = montar([foraDoAr]);
    await falharAteAbrir(busca);
    const chamadasAteAbrir = chamadas();

    await expect(busca.search('Vale')).rejects.toBeInstanceOf(CircuitoAbertoError);
    expect(chamadas()).toBe(chamadasAteAbrir);
  });

  it('depois do resfriamento deixa uma busca passar; se der certo, o circuito fecha', async () => {
    const roteiro: Array<'ok' | Error> = Array(FALHAS_PARA_ABRIR * 3).fill(foraDoAr);
    const { busca, avancar } = montar([...roteiro, 'ok']);
    await falharAteAbrir(busca);

    avancar(RESFRIAMENTO_MS);

    expect(await busca.search('Vale')).toEqual(RESULTADO);
    // Fechado de novo: uma falha isolada não reabre.
    expect(await busca.search('Vale')).toEqual(RESULTADO);
  });

  it('se a busca de teste falhar, reabre na hora', async () => {
    const { busca, avancar } = montar([foraDoAr]);
    await falharAteAbrir(busca);

    avancar(RESFRIAMENTO_MS);
    await expect(busca.search('Vale')).rejects.toBe(foraDoAr);

    await expect(busca.search('Vale')).rejects.toBeInstanceOf(CircuitoAbertoError);
  });

  it('o erro de circuito aberto se identifica pelo nome que a API procura', () => {
    expect(new CircuitoAbertoError().name).toBe('CircuitoAbertoError');
  });
});
