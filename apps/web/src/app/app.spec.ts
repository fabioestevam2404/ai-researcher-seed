import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { HealthResponse } from '@hero/contracts';
import { ChatService } from './api/chat.service';
import { HealthService } from './api/health.service';
import { App } from './app';
import { routes } from './app.routes';
import { ChatStore } from './state/chat.store';
import { Chat } from './chat/chat';
import { Health } from './health/health';

const saudavel: HealthResponse = { status: 'ok', database: 'ok' };

const DISCLAIMER =
  'Este assistente apresenta informações públicas, não recomendação de investimento.';

// Exigência regulatória: o aviso está no layout raiz, em todas as rotas, e não tem como sumir.
describe('disclaimer', () => {
  async function montarApp() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        // Health responde na hora: este teste é sobre o layout, não sobre a API.
        { provide: HealthService, useValue: { fetchHealth: async () => saudavel } },
        // Stream que abre e nunca entrega o próximo evento: a resposta fica "em andamento".
        {
          provide: ChatService,
          useValue: {
            ask: () => ({
              [Symbol.asyncIterator]: () => ({ next: () => new Promise<never>(() => {}) }),
            }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture;
  }

  function disclaimer(fixture: ComponentFixture<App>): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('[role="note"]');
  }

  it('aparece no chat e no health, sem nenhum botão para fechar', async () => {
    const fixture = await montarApp();
    const router = TestBed.inject(Router);

    for (const url of ['/', '/health']) {
      await router.navigateByUrl(url);
      await fixture.whenStable();

      expect(disclaimer(fixture)?.textContent?.trim()).toBe(DISCLAIMER);
      expect(disclaimer(fixture)?.querySelector('button')).toBeNull();
    }
  });

  it('continua visível com uma resposta em andamento', async () => {
    const fixture = await montarApp();
    await TestBed.inject(Router).navigateByUrl('/');
    void TestBed.inject(ChatStore).perguntar('Receita da Vale?');
    await fixture.whenStable();

    expect(TestBed.inject(ChatStore).emAndamento()).toBe(true);
    expect(disclaimer(fixture)?.textContent).toContain(DISCLAIMER);
  });
});

// Rotas de verdade (as mesmas do app.config), sem mock do Router.
describe('rotas', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  it('a página inicial é o chat', async () => {
    expect(await harness.navigateByUrl('/', Chat)).toBeInstanceOf(Chat);
  });

  it('/health mostra o status vindo de /api/health, sem tocar rede de verdade', async () => {
    await harness.navigateByUrl('/health', Health);

    httpMock.expectOne('/api/health').flush({ status: 'ok', database: 'ok' });
    await harness.fixture.whenStable();

    const texto = (harness.routeNativeElement as HTMLElement).textContent;
    expect(texto).toContain('status: ok');
    expect(texto).toContain('database: ok');
  });

  it('URL desconhecida volta para o chat', async () => {
    await harness.navigateByUrl('/nao-existe');

    expect(TestBed.inject(Router).url).toBe('/');
  });
});
