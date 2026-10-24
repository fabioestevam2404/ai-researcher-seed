import { computed, Injectable, signal } from '@angular/core';
import type { ChatEvent } from '@hero/contracts';

// Espelha MAX_ITERATIONS de packages/agent/src/graph.ts. O frontend nunca importa
// @hero/agent (traria LangGraph e Postgres para o navegador), então o valor é repetido aqui.
// Se mudar lá, a previsão do painel erra o caminho até alguém mudar aqui também.
export const MAX_ITERATIONS = 2;

export type NomeEtapa = 'retrieve' | 'grade' | 'webSearch' | 'answer';

export interface Etapa {
  nome: NomeEtapa;
  estado: 'pendente' | 'executando' | 'concluida';
  // Só nas concluídas: o evento traz a duração medida no servidor e o detalhe do nó.
  evento?: Exclude<ChatEvent, { node: 'error' }>;
}

// O caminho que o grafo ainda vai percorrer, dado o último nó concluído. Repete as regras das
// arestas do grafo: grade suficiente (ou no limite de iterações) vai para answer; insuficiente
// vai para webSearch, que volta para retrieve.
export function caminhoRestante(ultimo: ChatEvent | undefined): NomeEtapa[] {
  switch (ultimo?.node) {
    case undefined:
      return ['retrieve', 'grade', 'answer'];
    case 'retrieve':
      return ['grade', 'answer'];
    case 'grade':
      return ultimo.sufficient || ultimo.iterations >= MAX_ITERATIONS
        ? ['answer']
        : ['webSearch', 'retrieve', 'grade', 'answer'];
    case 'webSearch':
      return ['retrieve', 'grade', 'answer'];
    case 'answer':
    case 'error':
      return [];
  }
}

@Injectable({ providedIn: 'root' })
export class GraphStore {
  private readonly _eventos = signal<ChatEvent[]>([]);
  private readonly _ativo = signal(false);

  // Linha do tempo do painel: o que já terminou, a etapa em execução e o caminho previsto.
  // Uma segunda passagem pelo retrieve aparece como uma nova linha — o loop fica visível.
  readonly etapas = computed<Etapa[]>(() => {
    const eventos = this._eventos();
    const concluidas: Etapa[] = eventos
      .filter((evento) => evento.node !== 'error')
      .map((evento) => ({ nome: evento.node, estado: 'concluida', evento }));

    if (!this._ativo()) return concluidas;

    const [proxima, ...depois] = caminhoRestante(eventos.at(-1));
    return [
      ...concluidas,
      ...(proxima ? [{ nome: proxima, estado: 'executando' as const }] : []),
      ...depois.map((nome) => ({ nome, estado: 'pendente' as const })),
    ];
  });

  // Banner de fallback: a busca web é caminho normal do grafo, não erro.
  readonly usouBuscaWeb = computed(() => this._eventos().some((e) => e.node === 'webSearch'));

  iniciar() {
    this._eventos.set([]);
    this._ativo.set(true);
  }

  registrar(evento: ChatEvent) {
    this._eventos.update((atuais) => [...atuais, evento]);
    if (evento.node === 'answer' || evento.node === 'error') this._ativo.set(false);
  }

  // Falha fora do stream (rede caiu): some a previsão, ficam só as etapas concluídas.
  interromper() {
    this._ativo.set(false);
  }
}
