import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  criarMcpServer,
  DESCRICAO_PERGUNTAR,
  MENSAGEM_ERRO_GENERICA,
  type GetGraph,
} from './server.js';

// Cliente e servidor MCP de verdade, ligados em memória: o protocolo inteiro roda, sem
// processo filho, rede, LLM ou banco.
async function conectar(getGraph: GetGraph) {
  const errosLogados: unknown[] = [];
  const server = criarMcpServer({ getGraph, logErro: (error) => errosLogados.push(error) });
  const [transporteCliente, transporteServidor] = InMemoryTransport.createLinkedPair();
  await server.connect(transporteServidor);

  const client = new Client({ name: 'teste', version: '0.0.0' });
  await client.connect(transporteCliente);
  return { client, errosLogados };
}

function texto(resultado: Awaited<ReturnType<Client['callTool']>>): string {
  const [conteudo] = resultado.content as Array<{ type: string; text: string }>;
  return conteudo.text;
}

describe('servidor MCP', () => {
  it('expõe uma única tool, perguntar, com a descrição para o agente cliente', async () => {
    const { client } = await conectar(async () => ({ invoke: async () => ({ answerText: '' }) }));

    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name)).toEqual(['perguntar']);
    expect(tools[0].description).toBe(DESCRICAO_PERGUNTAR);
    expect(DESCRICAO_PERGUNTAR).toMatch(/20 empresas da B3/);
    expect(DESCRICAO_PERGUNTAR).toMatch(/Nunca recomenda/);
  });

  it('CA-11: devolve a resposta já citada que o grafo produziu', async () => {
    const perguntas: string[] = [];
    const { client } = await conectar(async () => ({
      invoke: async ({ question }) => {
        perguntas.push(question);
        return { answerText: 'Receita de R$ 56,7 bilhões.\n\nFontes:\n- VALE · 3T25' };
      },
    }));

    const resultado = await client.callTool({
      name: 'perguntar',
      arguments: { pergunta: '  Receita da Vale no 3T25?  ' },
    });

    expect(resultado.isError).toBeFalsy();
    expect(texto(resultado)).toContain('Fontes:');
    // A validação do contrato também apara os espaços, como no /api/chat.
    expect(perguntas).toEqual(['Receita da Vale no 3T25?']);
  });

  it('CA-11: erro do grafo vira isError com mensagem genérica; o detalhe só vai para o log', async () => {
    const { client, errosLogados } = await conectar(async () => ({
      invoke: async () => {
        throw new Error('Vertex AI fora do ar');
      },
    }));

    const resultado = await client.callTool({ name: 'perguntar', arguments: { pergunta: 'x' } });

    expect(resultado.isError).toBe(true);
    expect(texto(resultado)).toBe(MENSAGEM_ERRO_GENERICA);
    expect(JSON.stringify(resultado)).not.toContain('Vertex');
    expect(errosLogados).toHaveLength(1);
  });

  it('pergunta vazia é recusada pela validação, sem chegar ao grafo', async () => {
    let chamadas = 0;
    const { client } = await conectar(async () => ({
      invoke: async () => {
        chamadas += 1;
        return { answerText: '' };
      },
    }));

    const resultado = await client.callTool({ name: 'perguntar', arguments: { pergunta: '   ' } });

    expect(resultado.isError).toBe(true);
    expect(chamadas).toBe(0);
  });
});
