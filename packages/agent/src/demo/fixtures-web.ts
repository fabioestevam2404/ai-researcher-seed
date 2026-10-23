import type { SearchResult } from '../search/types.js';

// Páginas congeladas para o modo demo. O conteúdo é FICTÍCIO e se declara como tal no
// título, no domínio (.invalid nunca resolve) e no próprio texto: uma resposta gravada em
// aula nunca deve citar uma notícia inventada como se fosse real.
export interface FixtureWeb {
  // A busca escolhe a fixture se a query contém alguma destas palavras (sem acento).
  palavrasChave: string[];
  resultado: SearchResult;
  html: string;
}

const DOMINIO_DEMO = 'https://demo.ai-researcher.invalid';

const AVISO_FICTICIO =
  'Conteúdo fictício de demonstração, criado para o modo DEMO do AI Researcher. ' +
  'Não é notícia, comunicado nem fato relevante real.';

function pagina(titulo: string, paragrafos: string[]): string {
  return [
    '<html><head><title>',
    titulo,
    '</title></head><body>',
    '<nav>Menu do site de demonstração</nav>',
    `<article><h1>${titulo}</h1>`,
    `<p><strong>${AVISO_FICTICIO}</strong></p>`,
    ...paragrafos.map((texto) => `<p>${texto}</p>`),
    '</article>',
    '<footer>Rodapé do site de demonstração</footer>',
    '</body></html>',
  ].join('\n');
}

const vale: FixtureWeb = {
  palavrasChave: ['vale'],
  resultado: {
    title: '[DEMO] Vale explica a queda de receita entre o 4T25 e o 1T26',
    snippet: 'Conteúdo fictício: sazonalidade de embarques e preço do minério.',
    url: `${DOMINIO_DEMO}/vale-receita-1t26`,
  },
  html: pagina('[DEMO] Vale explica a queda de receita entre o 4T25 e o 1T26', [
    'Segundo este texto de demonstração, a receita da Vale no primeiro trimestre de 2026 ficou ' +
      'abaixo da registrada no quarto trimestre de 2025 por dois motivos principais.',
    'O primeiro é sazonal: o primeiro trimestre concentra o período de chuvas nas operações do ' +
      'Norte, o que reduz a produção e o volume de minério de ferro embarcado.',
    'O segundo é o preço: o texto atribui parte da queda a um preço médio realizado do minério ' +
      'mais baixo no período, em comparação com o trimestre anterior.',
  ]),
};

const petrobras: FixtureWeb = {
  palavrasChave: ['petrobras'],
  resultado: {
    title: '[DEMO] Petrobras divulga fato relevante sobre plano de investimentos',
    snippet: 'Conteúdo fictício: comunicado de demonstração sobre investimentos.',
    url: `${DOMINIO_DEMO}/petrobras-fato-relevante`,
  },
  html: pagina('[DEMO] Petrobras divulga fato relevante sobre plano de investimentos', [
    'Neste comunicado de demonstração, a Petrobras informa ao mercado a aprovação, pelo seu ' +
      'conselho de administração, de uma revisão do plano de investimentos para os próximos anos.',
    'O texto descreve, de forma genérica, a priorização de projetos de exploração e produção ' +
      'e a manutenção da política de remuneração aos acionistas já divulgada.',
    'Por ser fictício, este documento existe apenas para mostrar o caminho do fallback de busca ' +
      'web no grafo, sem depender de rede durante a gravação.',
  ]),
};

const klabin: FixtureWeb = {
  palavrasChave: ['klabin'],
  resultado: {
    title: '[DEMO] O que explica o prejuízo da Klabin no 1T26',
    snippet: 'Conteúdo fictício: variação cambial sobre a dívida em dólar.',
    url: `${DOMINIO_DEMO}/klabin-prejuizo-1t26`,
  },
  html: pagina('[DEMO] O que explica o prejuízo da Klabin no 1T26', [
    'De acordo com este texto de demonstração, o prejuízo líquido da Klabin no primeiro ' +
      'trimestre de 2026 não veio da operação, que seguiu gerando caixa.',
    'O texto atribui o resultado negativo ao efeito contábil da variação cambial sobre a dívida ' +
      'denominada em dólar, registrado no resultado financeiro do trimestre.',
    'Também menciona paradas programadas de manutenção em fábricas como fator secundário, com ' +
      'impacto sobre o volume vendido.',
  ]),
};

// Usada quando a pergunta não cita nenhuma das empresas acima: o fallback continua
// demonstrável, e a resposta honesta é "contexto incompleto".
export const fixtureGenerica: FixtureWeb = {
  palavrasChave: [],
  resultado: {
    title: '[DEMO] Página genérica de demonstração',
    snippet: 'Conteúdo fictício sem informação específica sobre a empresa pesquisada.',
    url: `${DOMINIO_DEMO}/generica`,
  },
  html: pagina('[DEMO] Página genérica de demonstração', [
    'Esta página de demonstração é devolvida quando a pergunta não cita nenhuma das empresas ' +
      'com conteúdo congelado no modo DEMO (Vale, Petrobras e Klabin).',
    'Ela não traz nenhum dado sobre a empresa pesquisada. O comportamento esperado do agente é ' +
      'reconhecer que o contexto é insuficiente e dizer isso na resposta, sem inventar.',
    'Para ver o fallback com conteúdo, pergunte sobre o motivo da queda de receita da Vale, um ' +
      'fato relevante da Petrobras ou o prejuízo da Klabin.',
  ]),
};

export const fixturesWeb: FixtureWeb[] = [vale, petrobras, klabin];
