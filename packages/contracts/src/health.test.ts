import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('aceita um payload válido', () => {
    expect(() => healthResponseSchema.parse({ status: 'ok', database: 'ok' })).not.toThrow();
  });

  it('rejeita status fora do enum', () => {
    expect(() => healthResponseSchema.parse({ status: 'up', database: 'ok' })).toThrow();
  });
});
