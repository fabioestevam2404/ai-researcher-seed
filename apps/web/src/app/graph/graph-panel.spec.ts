import { TestBed } from '@angular/core/testing';
import type { ChatEvent } from '@hero/contracts';
import { GraphStore } from '../state/graph.store';
import { formatarDuracao, GraphPanel } from './graph-panel';

function grade(sufficient: boolean, iterations: number): ChatEvent {
  return { node: 'grade', durationMs: 2006, sufficient, missingAspects: [], iterations };
}

async function renderizar(preparar: (store: GraphStore) => void) {
  const fixture = TestBed.createComponent(GraphPanel);
  preparar(TestBed.inject(GraphStore));
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

// Lê cada coluna da linha (nome com detalhe, duração ou situação) e junta com espaço — na
// tela quem separa as colunas é o gap do flex, não um espaço no texto.
function linhas(el: HTMLElement): string[] {
  return [...el.querySelectorAll('li')].map((li) =>
    [...li.querySelectorAll(':scope > span')]
      .map((coluna) => coluna.textContent!.replace(/\s+/g, ' ').trim())
      .join(' '),
  );
}

describe('formatarDuracao', () => {
  it('mostra segundos com uma casa e vírgula', () => {
    expect(formatarDuracao(12087)).toBe('12,1 s');
    expect(formatarDuracao(367)).toBe('0,4 s');
  });
});

describe('GraphPanel', () => {
  it('antes da primeira pergunta, explica o que vai aparecer', async () => {
    const el = await renderizar(() => {});

    expect(el.textContent).toContain('aparecem aqui quando você faz uma pergunta');
    expect(el.querySelectorAll('li')).toHaveLength(0);
  });

  it('em andamento: concluída com duração, a próxima em execução e o resto pendente', async () => {
    const el = await renderizar((store) => {
      store.iniciar();
      store.registrar({ node: 'retrieve', durationMs: 1032, documents: [] });
    });

    expect(linhas(el)).toEqual(['retrieve 1,0 s', 'grade em execução', 'answer pendente']);
    expect(el.querySelector('li.executando [aria-label="Em execução"]')).not.toBeNull();
  });

  it('consulta estruturada aparece como "consulta · indicadores", sem busca web', async () => {
    const el = await renderizar((store) => {
      store.iniciar();
      for (const evento of [
        { node: 'retrieve', durationMs: 600, documents: [] },
        { ...grade(false, 1), consultaEstruturada: true },
        { node: 'queryIndicators', durationMs: 40, documents: [] },
        { node: 'answer', durationMs: 5000, answer: 'ok' },
      ] as ChatEvent[]) {
        store.registrar(evento);
      }
    });

    expect(linhas(el)).toEqual([
      'retrieve 0,6 s',
      'grade · insuficiente 2,0 s',
      'consulta · indicadores 0,0 s',
      'answer 5,0 s',
    ]);
    expect(el.querySelectorAll('li.busca-web')).toHaveLength(0);
  });

  it('o loop aparece inteiro, com a busca web em ciano e a 2ª passagem indicada', async () => {
    const el = await renderizar((store) => {
      store.iniciar();
      for (const evento of [
        { node: 'retrieve', durationMs: 12087, documents: [] },
        grade(false, 1),
        { node: 'webSearch', durationMs: 1036 },
        { node: 'retrieve', durationMs: 367, documents: [] },
        grade(true, 2),
        { node: 'answer', durationMs: 14591, answer: 'ok' },
      ] as ChatEvent[]) {
        store.registrar(evento);
      }
    });

    expect(linhas(el)).toEqual([
      'retrieve 12,1 s',
      'grade · insuficiente 2,0 s',
      'search · busca web 1,0 s',
      'retrieve · 2ª passagem 0,4 s',
      'grade · suficiente 2,0 s',
      'answer 14,6 s',
    ]);
    expect(el.querySelectorAll('li.busca-web')).toHaveLength(1);
    expect(el.textContent).toContain('2ª iteração');
  });
});
