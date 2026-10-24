import { TestBed } from '@angular/core/testing';
import type { ChatEvent } from '@hero/contracts';
import { ChatService } from '../api/chat.service';
import { GraphStore } from './graph.store';
import {
  ChatStore,
  INTERVALO_REVELACAO_MS,
  MENSAGEM_ERRO,
  tokenize,
  type MensagemAssistente,
} from './chat.store';

const RESPOSTA =
  'Receita de R$ 56,7 bilhões.\n\nFontes:\n- VALE · 3T25 (data-base 2025-09-30) — https://cvm/x.zip';

// ChatService falso: devolve os eventos da lista (ou lança o erro) e guarda o sinal de abort.
function servicoFalso(eventos: ChatEvent[], erro?: Error) {
  const sinais: AbortSignal[] = [];
  const servico = {
    async *ask(_pergunta: string, signal?: AbortSignal) {
      if (signal) sinais.push(signal);
      if (erro) throw erro;
      for (const evento of eventos) yield evento;
    },
  };
  return { servico, sinais };
}

function montar(eventos: ChatEvent[], erro?: Error) {
  const { servico, sinais } = servicoFalso(eventos, erro);
  TestBed.configureTestingModule({ providers: [{ provide: ChatService, useValue: servico }] });
  return { store: TestBed.inject(ChatStore), sinais };
}

function resposta(store: ChatStore): MensagemAssistente {
  return store.mensagens().at(-1) as MensagemAssistente;
}

const eventosNormais: ChatEvent[] = [
  { node: 'retrieve', durationMs: 100, documents: [] },
  { node: 'grade', durationMs: 50, sufficient: true, missingAspects: [], iterations: 1 },
  { node: 'answer', durationMs: 900, answer: RESPOSTA },
];

describe('tokenize', () => {
  it('quebra por palavra sem perder espaços nem quebras de linha', () => {
    const texto = 'Receita de\nR$ 56,7  bilhões.';

    expect(tokenize(texto)).toEqual(['Receita ', 'de\n', 'R$ ', '56,7  ', 'bilhões.']);
    expect(tokenize(texto).join('')).toBe(texto);
  });
});

describe('ChatStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra a pergunta e uma resposta aguardando enquanto o grafo trabalha', async () => {
    const { store } = montar(eventosNormais);

    const andamento = store.perguntar('  Receita da Vale?  ');

    expect(store.mensagens()[0]).toEqual({ autor: 'usuario', texto: 'Receita da Vale?' });
    expect(resposta(store).estado).toBe('aguardando');
    expect(store.emAndamento()).toBe(true);
    await andamento;
  });

  it('revela a resposta uma palavra a cada 70 ms e só então mostra as citações', async () => {
    const { store } = montar(eventosNormais);
    await store.perguntar('Receita da Vale?');

    vi.advanceTimersByTime(INTERVALO_REVELACAO_MS);
    expect(resposta(store)).toMatchObject({ texto: 'Receita ', estado: 'revelando' });
    expect(resposta(store).citacoes).toEqual([]);

    vi.advanceTimersByTime(INTERVALO_REVELACAO_MS * 10);
    expect(resposta(store)).toMatchObject({
      texto: 'Receita de R$ 56,7 bilhões.',
      estado: 'concluida',
    });
    expect(resposta(store).citacoes).toHaveLength(1);
    expect(store.emAndamento()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('evento de erro do servidor vira a mensagem fixa', async () => {
    const { store } = montar([{ node: 'error', message: 'detalhe que não importa' }]);

    await store.perguntar('x');

    expect(resposta(store)).toMatchObject({ texto: MENSAGEM_ERRO, estado: 'erro' });
    expect(store.emAndamento()).toBe(false);
  });

  it('falha de rede vira a mesma mensagem fixa, nunca tela branca', async () => {
    const { store } = montar([], new TypeError('Failed to fetch'));

    await store.perguntar('x');

    expect(resposta(store)).toMatchObject({ texto: MENSAGEM_ERRO, estado: 'erro' });
  });

  it('stream que termina sem resposta também é falha', async () => {
    const { store } = montar([{ node: 'retrieve', durationMs: 1, documents: [] }]);

    await store.perguntar('x');

    expect(resposta(store).estado).toBe('erro');
  });

  it('ignora pergunta vazia e pergunta nova enquanto outra está em andamento', async () => {
    const { store } = montar(eventosNormais);

    await store.perguntar('   ');
    expect(store.vazio()).toBe(true);

    await store.perguntar('Primeira?');
    await store.perguntar('Segunda?');
    expect(store.mensagens().filter((m) => m.autor === 'usuario')).toHaveLength(1);
  });

  it('cada evento do stream também alimenta o painel do grafo', async () => {
    const { store } = montar(eventosNormais);

    await store.perguntar('Receita da Vale?');

    expect(
      TestBed.inject(GraphStore)
        .etapas()
        .map((e) => e.nome),
    ).toEqual(['retrieve', 'grade', 'answer']);
    expect(resposta(store).buscouNaWeb).toBe(false);
  });

  it('resposta que passou pela busca web guarda isso na própria mensagem', async () => {
    const { store } = montar([
      { node: 'retrieve', durationMs: 1, documents: [] },
      { node: 'grade', durationMs: 1, sufficient: false, missingAspects: ['x'], iterations: 1 },
      { node: 'webSearch', durationMs: 1 },
      { node: 'answer', durationMs: 1, answer: RESPOSTA },
    ]);

    await store.perguntar('Motivo do prejuízo da Klabin?');

    expect(resposta(store).buscouNaWeb).toBe(true);
  });

  it('ao ser destruído, para a revelação e fecha a conexão', async () => {
    const { store, sinais } = montar(eventosNormais);
    await store.perguntar('Receita da Vale?');
    vi.advanceTimersByTime(INTERVALO_REVELACAO_MS);
    expect(vi.getTimerCount()).toBe(1);

    TestBed.resetTestingModule();

    expect(vi.getTimerCount()).toBe(0);
    expect(sinais[0].aborted).toBe(true);
  });
});
