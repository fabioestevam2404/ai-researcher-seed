import { Injectable } from '@angular/core';
import { chatEventSchema, type ChatEvent } from '@hero/contracts';

// A API recusou a pergunta antes de abrir o stream (corpo inválido, limite de uso...).
export class ChatRequestError extends Error {
  constructor(readonly status: number) {
    super(`POST /api/chat respondeu HTTP ${status}`);
    this.name = 'ChatRequestError';
  }
}

// Lê um corpo text/event-stream e devolve o conteúdo das linhas "data:" de cada evento.
// A rede entrega pedaços de tamanho arbitrário: um evento pode chegar partido ao meio, e até
// um caractere acentuado pode vir dividido entre dois pedaços. Por isso o texto acumula até
// aparecer a linha em branco que fecha o evento.
export async function* lerEventosSse(corpo: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const leitor = corpo.getReader();
  const decodificador = new TextDecoder();
  let pendente = '';

  try {
    while (true) {
      const { value, done } = await leitor.read();
      if (done) break;
      // stream: true guarda os bytes de um caractere incompleto para o próximo pedaço.
      pendente += decodificador.decode(value, { stream: true });

      const eventos = pendente.split('\n\n');
      pendente = eventos.pop() ?? '';

      for (const evento of eventos) {
        const dados = evento
          .split('\n')
          .filter((linha) => linha.startsWith('data:'))
          .map((linha) => linha.slice('data:'.length).trimStart())
          .join('\n');
        if (dados) yield dados;
      }
    }
  } finally {
    // Se quem consome parar no meio (componente destruído), a conexão é fechada aqui.
    await leitor.cancel();
  }
}

// Única porta de rede do chat. Usa fetch em vez de HttpClient porque precisa ler o corpo
// aos poucos, evento por evento, enquanto o grafo ainda está trabalhando no servidor.
@Injectable({ providedIn: 'root' })
export class ChatService {
  async *ask(question: string, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
    const resposta = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ question }),
      signal,
    });

    if (!resposta.ok || !resposta.body) {
      throw new ChatRequestError(resposta.status);
    }

    for await (const dados of lerEventosSse(resposta.body)) {
      // Mesmo schema que a API usa para escrever: se os dois divergirem, falha aqui.
      yield chatEventSchema.parse(JSON.parse(dados));
    }
  }
}
