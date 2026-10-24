import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { GraphPanel } from '../graph/graph-panel';
import { ChatStore } from '../state/chat.store';

@Component({
  selector: 'app-chat',
  imports: [FormField, GraphPanel],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat {
  // O componente não conhece HTTP nem SSE: lê signals do store e emite a intenção de perguntar.
  protected readonly store = inject(ChatStore);

  protected readonly modelo = signal({ pergunta: '' });
  protected readonly formulario = form(this.modelo);

  // Campo vazio ou resposta em andamento: o botão fica desabilitado, e o visual acompanha.
  protected readonly podeEnviar = computed(
    () => this.modelo().pergunta.trim() !== '' && !this.store.emAndamento(),
  );

  protected enviar(evento?: Event) {
    evento?.preventDefault();
    if (!this.podeEnviar()) return;

    const pergunta = this.modelo().pergunta;
    this.modelo.set({ pergunta: '' });
    void this.store.perguntar(pergunta);
  }

  // Enter envia; Shift+Enter deixa o textarea quebrar a linha. isComposing evita enviar no meio
  // de uma composição de acento (teclados que montam "ã" em duas teclas).
  protected aoTeclar(evento: KeyboardEvent) {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.isComposing) {
      this.enviar(evento);
    }
  }
}
