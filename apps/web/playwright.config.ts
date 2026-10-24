import { defineConfig, devices } from '@playwright/test';

// E2E de ponta a ponta: o navegador fala com o Angular, que fala com a API de verdade pelo
// proxy. A API sobe em DEMO=true — grafo inteiro sem banco, Vertex AI nem rede —, então o
// teste é determinístico e roda igual na máquina e no CI.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Depende do build de @hero/agent e @hero/mcp-server (dist), como a API em produção.
      command: 'node --import tsx src/index.ts',
      cwd: '../api',
      env: { DEMO: 'true', PORT: '3000' },
      url: 'http://127.0.0.1:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm exec ng serve --proxy-config proxy.conf.json --port 4200',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
