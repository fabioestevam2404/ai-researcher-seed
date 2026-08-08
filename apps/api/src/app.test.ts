import { describe, expect, it } from 'vitest';
import { build } from './app.js';

describe('GET /api/health', () => {
  it('responde 200 com status e database ok', async () => {
    const app = build();

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', database: 'ok' });
  });
});
