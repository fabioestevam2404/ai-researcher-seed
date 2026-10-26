import { Component, computed, inject } from '@angular/core';
import { GraphStore, type Etapa, type NomeEtapa } from '../state/graph.store';

const ROTULOS: Record<NomeEtapa, string> = {
  retrieve: 'retrieve',
  grade: 'grade',
  webSearch: 'search',
  queryIndicators: 'consulta',
  answer: 'answer',
};

const SEGUNDOS = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// 12087 ms → "12,1 s". A duração vem do servidor, medida entre o fim de um nó e o do próximo.
export function formatarDuracao(ms: number): string {
  return `${SEGUNDOS.format(ms / 1000)} s`;
}

interface Linha {
  rotulo: string;
  detalhe: string;
  estado: Etapa['estado'];
  duracao: string;
  ehBuscaWeb: boolean;
}

// O detalhe ao lado do nome ajuda a ler o loop: por que o grafo foi à web e em que passagem está.
function detalhe(etapa: Etapa, passagem: number): string {
  const evento = etapa.evento;
  if (evento?.node === 'grade') return evento.sufficient ? 'suficiente' : 'insuficiente';
  if (etapa.nome === 'webSearch') return 'busca web';
  if (etapa.nome === 'queryIndicators') return 'indicadores';
  if (etapa.nome === 'retrieve' && passagem > 1) return `${passagem}ª passagem`;
  return '';
}

@Component({
  selector: 'app-graph-panel',
  imports: [],
  templateUrl: './graph-panel.html',
  styleUrl: './graph-panel.scss',
})
export class GraphPanel {
  private readonly graphStore = inject(GraphStore);

  protected readonly linhas = computed<Linha[]>(() => {
    const passagens: Partial<Record<NomeEtapa, number>> = {};

    return this.graphStore.etapas().map((etapa) => {
      const passagem = (passagens[etapa.nome] ?? 0) + 1;
      passagens[etapa.nome] = passagem;

      return {
        rotulo: ROTULOS[etapa.nome],
        detalhe: detalhe(etapa, passagem),
        estado: etapa.estado,
        duracao: etapa.evento ? formatarDuracao(etapa.evento.durationMs) : '',
        ehBuscaWeb: etapa.nome === 'webSearch',
      };
    });
  });

  // Uma iteração por passagem pelo grade, concluída ou em execução.
  protected readonly iteracoes = computed(
    () =>
      this.graphStore.etapas().filter((e) => e.nome === 'grade' && e.estado !== 'pendente').length,
  );
}
