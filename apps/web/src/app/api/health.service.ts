import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { HealthResponse } from '@hero/contracts';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  fetchHealth(): Promise<HealthResponse> {
    return firstValueFrom(this.http.get<HealthResponse>('/api/health'));
  }
}
