import type { Routes } from '@angular/router';
import { Chat } from './chat/chat';
import { Health } from './health/health';

// O chat é a página inicial; /health mostra o estado da API e do banco.
export const routes: Routes = [
  { path: '', component: Chat, title: 'AI Researcher' },
  { path: 'health', component: Health, title: 'AI Researcher · Health' },
  { path: '**', redirectTo: '' },
];
