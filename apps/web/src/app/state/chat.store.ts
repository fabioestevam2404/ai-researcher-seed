import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { ChatService } from '../api/chat.service';
import { GraphStore } from './graph.store';
import { parseAnswer, type Citacao, type RespostaAnalisada } from './parse-answer';

export const INTERVALO_REVELACAO_MS = 70;

// Texto fixo para qualquer falha: o usuário nunca vê tela branca nem detalhe técnico.
export const MENSAGEM_ERRO =
  'Não foi possível obter a resposta agora. Tente novamente em instantes.';

export interface MensagemUsuario {
  autor: 'usuario';
  texto: string;
}

export interface MensagemAssistente {
  autor: 'assistente';
  // Só a parte já revelada do texto.
  texto: string;
  citacoes: Citacao[];
  estado: 'aguardando' | 'revelando' | 'concluida' | 'erro';
}

export type Mensagem = MensagemUsuario | MensagemAssistente;

// Quebra o texto em palavras, cada uma com o espaço (ou quebra de linha) que vem depois dela.
// Juntar os pedaços devolve o texto original — a revelação não perde formatação.
export function tokenize(texto: string): string[] {
  return texto.match(/\S+\s*/g) ?? [];
}

@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly chatService = inject(ChatService);
  private readonly graphStore = inject(GraphStore);

  private readonly _mensagens = signal<Mensagem[]>([]);
  readonly mensagens = this._mensagens.asReadonly();

  private readonly _emAndamento = signal(false);
  readonly emAndamento = this._emAndamento.asReadonly();

  readonly vazio = computed(() => this._mensagens().length === 0);

  private timerRevelacao: ReturnType<typeof setInterval> | undefined;
  private conexao: AbortController | undefined;

  constructor() {
    // Timer esquecido continua rodando e conexão SSE esquecida mantém a instância do
    // Cloud Run viva (e cobrando). As duas são encerradas junto com o store.
    inject(DestroyRef).onDestroy(() => this.encerrar());
  }

  async perguntar(pergunta: string): Promise<void> {
    const texto = pergunta.trim();
    if (!texto || this._emAndamento()) return;

    this._emAndamento.set(true);
    this._mensagens.update((atuais) => [
      ...atuais,
      { autor: 'usuario', texto },
      { autor: 'assistente', texto: '', citacoes: [], estado: 'aguardando' },
    ]);

    const conexao = new AbortController();
    this.conexao = conexao;
    this.graphStore.iniciar();

    try {
      for await (const evento of this.chatService.ask(texto, conexao.signal)) {
        // Todo evento alimenta o painel do grafo; só answer e error mudam a conversa.
        this.graphStore.registrar(evento);
        if (evento.node === 'answer') {
          this.revelar(parseAnswer(evento.answer));
          return;
        }
        if (evento.node === 'error') {
          this.falhar();
          return;
        }
      }
      // O stream terminou sem resposta nem erro: para o usuário, é falha do mesmo jeito.
      this.falhar();
    } catch {
      this.graphStore.interromper();
      // Conexão abortada de propósito (store destruído) não é falha a mostrar.
      if (!conexao.signal.aborted) this.falhar();
    }
  }

  // A resposta chega inteira, já validada e filtrada pelo guardrail no servidor. A revelação
  // palavra por palavra é só apresentação: nada do que aparece deixou de passar pelo filtro.
  private revelar({ texto, citacoes }: RespostaAnalisada) {
    const palavras = tokenize(texto);
    let reveladas = 0;

    const avancar = () => {
      if (reveladas >= palavras.length) {
        this.pararRevelacao();
        this.atualizarResposta({ texto, citacoes, estado: 'concluida' });
        this._emAndamento.set(false);
        return;
      }
      reveladas += 1;
      this.atualizarResposta({ texto: palavras.slice(0, reveladas).join(''), estado: 'revelando' });
    };

    this.timerRevelacao = setInterval(avancar, INTERVALO_REVELACAO_MS);
  }

  private falhar() {
    this.atualizarResposta({ texto: MENSAGEM_ERRO, citacoes: [], estado: 'erro' });
    this._emAndamento.set(false);
  }

  // A resposta em andamento é sempre a última mensagem.
  private atualizarResposta(mudancas: Partial<MensagemAssistente>) {
    this._mensagens.update((atuais) => {
      const ultima = atuais.at(-1);
      if (ultima?.autor !== 'assistente') return atuais;
      return [...atuais.slice(0, -1), { ...ultima, ...mudancas }];
    });
  }

  private pararRevelacao() {
    clearInterval(this.timerRevelacao);
    this.timerRevelacao = undefined;
  }

  private encerrar() {
    this.pararRevelacao();
    this.conexao?.abort();
  }
}
