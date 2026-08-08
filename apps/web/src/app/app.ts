import { Component, inject, resource } from '@angular/core';
import { HealthService } from './api/health.service';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly healthService = inject(HealthService);

  protected readonly health = resource({
    loader: () => this.healthService.fetchHealth(),
  });
}
