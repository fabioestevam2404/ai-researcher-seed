import { TestBed } from '@angular/core/testing';
import type { ChatEvent } from '@hero/contracts';
import { ChatRequestError, ChatService, lerEventosSse } from './chat.service';

// Corpo de stream montado a partir de pedaços de bytes, como a rede entregaria.
function corpoEmPedacos(pedacos: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const pedaco of pedacos) controller.enqueue(pedaco);
      controller.close();
    },
  });
}

function bytes(texto: string): Uint8Array {
  return new TextEncoder().encode(texto);
}

async function coletar<T>(gerador: AsyncGenerator<T>): Promise<T[]> {
  const itens: T[] = [];
  for await (const item of gerador) itens.push(item);
  return itens;
}

const eventoRetrieve = { node: 'retrieve', durationMs: 120, documents: [] };
const eventoAnswer = { node: 'answer', durationMs: 900, answer: 'Receita de R$ 56,7 bilhões.' };

describe('lerEventosSse', () => {
  it('junta um evento que chegou partido em dois pedaços', async () => {
    const texto = `data: ${JSON.stringify(eventoRetrieve)}\n\ndata: ${JSON.stringify(eventoAnswer)}\n\n`;
    const meio = texto.length / 2;

    const dados = await coletar(
      lerEventosSse(corpoEmPedacos([bytes(texto.slice(0, meio)), bytes(texto.slice(meio))])),
    );

    expect(dados.map((d) => JSON.parse(d))).toEqual([eventoRetrieve, eventoAnswer]);
  });

  it('não corrompe acento dividido entre dois pedaços', async () => {
    const tudo = bytes('data: {"texto":"bilhões"}\n\n');
    const indiceDoO = tudo.indexOf(0xc3); // primeiro byte do "õ" em UTF-8
    const pedacos = [tudo.slice(0, indiceDoO + 1), tudo.slice(indiceDoO + 1)];

    expect(await coletar(lerEventosSse(corpoEmPedacos(pedacos)))).toEqual(['{"texto":"bilhões"}']);
  });
});

describe('ChatService.ask', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(resposta: Response) {
    const fetchFake = vi.fn<typeof fetch>(async () => resposta);
    vi.stubGlobal('fetch', fetchFake);
    return fetchFake;
  }

  it('envia a pergunta e devolve os eventos já validados pelo contrato', async () => {
    const corpo = `data: ${JSON.stringify(eventoRetrieve)}\n\ndata: ${JSON.stringify(eventoAnswer)}\n\n`;
    const fetchFake = stubFetch(new Response(corpo, { status: 200 }));

    const eventos: ChatEvent[] = await coletar(TestBed.inject(ChatService).ask('Receita da Vale?'));

    const [url, init] = fetchFake.mock.calls[0];
    expect(url).toBe('/api/chat');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ question: 'Receita da Vale?' });
    expect(eventos.map((e) => e.node)).toEqual(['retrieve', 'answer']);
  });

  it('resposta de erro antes do stream vira ChatRequestError com o status', async () => {
    stubFetch(new Response('{}', { status: 400 }));

    await expect(coletar(TestBed.inject(ChatService).ask('x'))).rejects.toMatchObject({
      name: 'ChatRequestError',
      status: 400,
    });
    expect(new ChatRequestError(429)).toBeInstanceOf(Error);
  });

  it('evento fora do contrato é erro, não dado silenciosamente errado', async () => {
    stubFetch(new Response('data: {"node":"desconhecido"}\n\n', { status: 200 }));

    await expect(coletar(TestBed.inject(ChatService).ask('x'))).rejects.toThrow();
  });
});
