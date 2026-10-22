import { defineConfig } from 'drizzle-kit';

// Local, o DATABASE_URL vem do .env da raiz (o mesmo que o dev da API carrega).
// Em CI e produção o arquivo não existe e a variável já está no ambiente.
try {
  process.loadEnvFile('../../.env');
} catch {
  // sem .env: segue com o ambiente atual
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    // Mesma variável da API: local vem do .env da raiz, produção do Secret Manager.
    url: process.env.DATABASE_URL ?? '',
  },
});
