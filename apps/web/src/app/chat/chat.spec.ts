import { TestBed } from '@angular/core/testing';
import type { ChatEvent } from '@hero/contracts';
import { ChatService } from '../api/chat.service';
import { MENSAGEM_ERRO } from '../state/chat.store';
import { Chat } from './chat';

const RESPOSTA =
  'Receita de R$ 56,7 bilhões.\n\nFontes:\n- VALE · 3T25 (data-base 2025-09-30) — https://dados.cvm.gov.br/x.zip';

// ChatService falso. Com `segurar`, o stream fica aberto até o teste liberar — é a janela em
// que a resposta está "em andamento".
function servicoFalso(eventos: ChatEvent[], segurar = false) {
  let liberar: () => void = () => {};
  const portao = new Promise<void>((resolve) => (liberar = resolve));
  const perguntas: string[] = [];
  const servico = {
    async *ask(pergunta: string) {
      perguntas.push(pergunta);
      if (segurar) await portao;
      for (const evento of eventos) yield evento;
    },
  };
  return { servico, perguntas, liberar: () => liberar() };
}

async function montar(servico: object) {
  TestBed.configureTestingModule({ providers: [{ provide: ChatService, useValue: servico }] });
  const fixture = TestBed.createComponent(Chat);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const campo = el.querySelector('textarea')!;
  const botao = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  const digitar = async (texto: string) => {
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const teclar = async (init: KeyboardEventInit) => {
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, ...init }));
    await fixture.whenStable();
  };
  return { fixture, el, campo, botao, digitar, teclar };
}

describe('Chat', () => {
  it('botão desabilitado com o campo vazio ou só com espaços', async () => {
    const { botao, digitar } = await montar(servicoFalso([]).servico);

    expect(botao.disabled).toBe(true);
    await digitar('   ');
    expect(botao.disabled).toBe(true);
    await digitar('Receita da Vale?');
    expect(botao.disabled).toBe(false);
  });

  it('Enter envia a pergunta e limpa o campo; Shift+Enter não envia', async () => {
    const { servico, perguntas } = servicoFalso([]);
    const { campo, digitar, teclar } = await montar(servico);

    await digitar('Receita da Vale?');
    await teclar({ shiftKey: true });
    expect(perguntas).toEqual([]);

    await teclar({});
    expect(perguntas).toEqual(['Receita da Vale?']);
    expect(campo.value).toBe('');
  });

  it('com resposta em andamento, o botão fica desabilitado mesmo com texto no campo', async () => {
    const falso = servicoFalso([{ node: 'answer', durationMs: 1, answer: RESPOSTA }], true);
    const { el, botao, digitar, teclar, fixture } = await montar(falso.servico);

    await digitar('Primeira?');
    await teclar({});
    await digitar('Segunda?');

    expect(botao.disabled).toBe(true);
    expect(el.textContent).toContain('Aguarde a resposta atual');
    expect(el.querySelector('.aguardando')).not.toBeNull();

    falso.liberar();
    await fixture.whenStable();
  });

  it('mostra a pergunta e a resposta com citação clicável, origem e data-base', async () => {
    const { el, digitar, teclar, fixture } = await montar(
      servicoFalso([{ node: 'answer', durationMs: 1, answer: RESPOSTA }]).servico,
    );

    await digitar('Receita da Vale?');
    await teclar({});
    // 5 palavras × 70 ms de revelação. Espera real curta: o ritmo em si é testado no ChatStore.
    await new Promise((resolve) => setTimeout(resolve, 600));
    await fixture.whenStable();

    expect(el.querySelector('.bolha-usuario')?.textContent).toBe('Receita da Vale?');
    expect(el.querySelector('.resposta .texto')?.textContent).toBe('Receita de R$ 56,7 bilhões.');
    const citacao = el.querySelector<HTMLAnchorElement>('a.citacao')!;
    expect(citacao.href).toBe('https://dados.cvm.gov.br/x.zip');
    expect(citacao.target).toBe('_blank');
    expect(citacao.textContent).toContain('Base local (CVM)');
    expect(citacao.textContent).toContain('data-base 2025-09-30');
  });

  it('falha mostra a mensagem fixa, nunca tela branca', async () => {
    const { el, digitar, teclar } = await montar(
      servicoFalso([{ node: 'error', message: 'interno' }]).servico,
    );

    await digitar('x');
    await teclar({});

    expect(el.querySelector('.resposta')?.textContent).toContain(MENSAGEM_ERRO);
  });
});
