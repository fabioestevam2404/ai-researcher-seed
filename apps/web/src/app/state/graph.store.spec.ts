import { TestBed } from '@angular/core/testing';
import type { ChatEvent } from '@hero/contracts';
import { caminhoRestante, GraphStore, MAX_ITERATIONS } from './graph.store';

const retrieve: ChatEvent = { node: 'retrieve', durationMs: 120, documents: [] };
const webSearch: ChatEvent = { node: 'webSearch', durationMs: 900 };
const answer: ChatEvent = { node: 'answer', durationMs: 700, answer: 'ok' };

function grade(sufficient: boolean, iterations: number): ChatEvent {
  return { node: 'grade', durationMs: 50, sufficient, missingAspects: [], iterations };
}

// Formato compacto para comparar a linha do tempo: "nome:estado".
function linhaDoTempo(store: GraphStore): string[] {
  return store.etapas().map((e) => `${e.nome}:${e.estado}`);
}

describe('caminhoRestante', () => {
  it('grade insuficiente antes do limite prevê a volta pela busca web', () => {
    expect(caminhoRestante(grade(false, 1))).toEqual(['webSearch', 'retrieve', 'grade', 'answer']);
  });

  it('grade insuficiente no limite de iterações vai direto para answer, como o grafo', () => {
    expect(caminhoRestante(grade(false, MAX_ITERATIONS))).toEqual(['answer']);
  });

  it('depois do answer não há mais nada', () => {
    expect(caminhoRestante(answer)).toEqual([]);
  });
});

describe('GraphStore', () => {
  let store: GraphStore;

  beforeEach(() => {
    store = TestBed.inject(GraphStore);
  });

  it('ao iniciar, o retrieve está em execução e o resto do caminho direto fica pendente', () => {
    store.iniciar();

    expect(linhaDoTempo(store)).toEqual([
      'retrieve:executando',
      'grade:pendente',
      'answer:pendente',
    ]);
  });

  it('cada evento conclui sua etapa, com a duração do servidor, e coloca a próxima em execução', () => {
    store.iniciar();
    store.registrar(retrieve);

    expect(linhaDoTempo(store)).toEqual([
      'retrieve:concluida',
      'grade:executando',
      'answer:pendente',
    ]);
    expect(store.etapas()[0].evento?.durationMs).toBe(120);
  });

  it('o loop aparece inteiro: a segunda passagem pelo retrieve é uma nova linha', () => {
    store.iniciar();
    for (const evento of [retrieve, grade(false, 1), webSearch, retrieve, grade(true, 2), answer]) {
      store.registrar(evento);
    }

    expect(linhaDoTempo(store)).toEqual([
      'retrieve:concluida',
      'grade:concluida',
      'webSearch:concluida',
      'retrieve:concluida',
      'grade:concluida',
      'answer:concluida',
    ]);
    expect(store.usouBuscaWeb()).toBe(true);
  });

  it('sem busca web, não há banner de fallback', () => {
    store.iniciar();
    for (const evento of [retrieve, grade(true, 1), answer]) store.registrar(evento);

    expect(store.usouBuscaWeb()).toBe(false);
  });

  it('erro do servidor encerra a previsão e mantém só o que concluiu', () => {
    store.iniciar();
    store.registrar(retrieve);
    store.registrar({ node: 'error', message: 'falhou' });

    expect(linhaDoTempo(store)).toEqual(['retrieve:concluida']);
  });

  it('interromper (falha de rede) também encerra a previsão', () => {
    store.iniciar();
    store.interromper();

    expect(store.etapas()).toEqual([]);
  });

  it('nova pergunta limpa a linha do tempo anterior', () => {
    store.iniciar();
    store.registrar(retrieve);
    store.iniciar();

    expect(linhaDoTempo(store)[0]).toBe('retrieve:executando');
    expect(store.etapas()).toHaveLength(3);
  });
});
