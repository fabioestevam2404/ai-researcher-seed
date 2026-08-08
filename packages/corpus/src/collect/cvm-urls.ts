export type TipoDocumento = 'ITR' | 'DFP';

export function urlZipCvm(tipo: TipoDocumento, ano: number): string {
  const prefixo = tipo.toLowerCase();
  return `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/${tipo}/DADOS/${prefixo}_cia_aberta_${ano}.zip`;
}

export function nomeArquivoCsv(tipo: TipoDocumento, demonstrativo: string, ano: number): string {
  const prefixo = tipo.toLowerCase();
  return `${prefixo}_cia_aberta_${demonstrativo}_${ano}.csv`;
}
