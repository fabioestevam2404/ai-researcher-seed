import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { Chat } from './chat/chat';
import { Health } from './health/health';

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
