import { criarCallbacksLangfuse, getRealGraph, iniciarTelemetria } from '@hero/agent';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { criarMcpServer } from './server.js';

// Ponto de entrada local: o cliente MCP (Claude Code, por exemplo) inicia este processo e
// conversa com ele por stdin/stdout. Nada pode ser escrito no stdout além do protocolo.
iniciarTelemetria();
const server = criarMcpServer({ getGraph: getRealGraph, criarCallbacks: criarCallbacksLangfuse });

await server.connect(new StdioServerTransport());
console.error('AI Researcher MCP (stdio) pronto.');
