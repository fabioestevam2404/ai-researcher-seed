import { describe, expect, it } from 'vitest';
import { build } from './app.js';

describe('GET /api/health', () => {
  it('responde ok quando o banco está saudável', async () => {
    const app = build({ checkDatabase: async () => true });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', database: 'ok' });
  });

  it('responde degraded (mas HTTP 200) quando o banco falha — falha de banco não derruba o serviço', async () => {
    const app = build({ checkDatabase: async () => false });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'degraded', database: 'error' });
  });
});
