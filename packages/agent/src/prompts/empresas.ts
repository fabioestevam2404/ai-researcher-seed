// As 20 empresas do corpus (packages/corpus/data/documentos/), com o nome pelo qual são
// conhecidas quando a razão social é outra. Um teste garante que a lista acompanha os arquivos.
// Usada por dois prompts: o answer, para saber se uma empresa está na base, e o grade, para
// escrever os tickers da consulta estruturada.
export const EMPRESAS_DO_CORPUS: Array<{ ticker: string; nome: string }> = [
  { ticker: 'ABEV', nome: 'Ambev' },
  { ticker: 'ASAI', nome: 'Sendas Distribuidora (Assaí)' },
  { ticker: 'BBAS', nome: 'Banco do Brasil' },
  { ticker: 'BBDC', nome: 'Bradesco' },
  { ticker: 'BRFS', nome: 'BRF' },
  { ticker: 'CMIG', nome: 'Cemig' },
  { ticker: 'CSNA', nome: 'CSN (Cia Siderúrgica Nacional)' },
  { ticker: 'EGIE', nome: 'Engie Brasil Energia' },
  { ticker: 'ELET', nome: 'Axia Energia (Eletrobras)' },
  { ticker: 'GGBR', nome: 'Gerdau' },
  { ticker: 'ITUB', nome: 'Itaú Unibanco' },
  { ticker: 'JBSS', nome: 'JBS' },
  { ticker: 'KLBN', nome: 'Klabin' },
  { ticker: 'LREN', nome: 'Lojas Renner' },
  { ticker: 'MGLU', nome: 'Magazine Luiza' },
  { ticker: 'PETR', nome: 'Petrobras' },
  { ticker: 'PRIO', nome: 'Prio' },
  { ticker: 'SUZB', nome: 'Suzano' },
  { ticker: 'TOTS', nome: 'Totvs' },
  { ticker: 'VALE', nome: 'Vale' },
];

export const LISTA_EMPRESAS = EMPRESAS_DO_CORPUS.map((e) => `${e.nome} (${e.ticker})`).join(', ');
