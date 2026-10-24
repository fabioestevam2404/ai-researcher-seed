import { Component, inject, resource } from '@angular/core';
import { HealthService } from '../api/health.service';

@Component({
  selector: 'app-health',
  imports: [],
  templateUrl: './health.html',
  styleUrl: './health.scss',
})
export class Health {
  private readonly healthService = inject(HealthService);

  protected readonly health = resource({
    loader: () => this.healthService.fetchHealth(),
  });
}
