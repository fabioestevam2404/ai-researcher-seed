import type { DocumentoRecuperado } from '../documento.js';

// Segunda defesa do guardrail: um filtro determinístico sobre o texto que o modelo
// devolveu. Se o modelo recomendar por engano — ou for convencido pelo usuário —, a
// resposta inteira é trocada por este aviso fixo. As fontes continuam anexadas.
export const AVISO_GUARDRAIL =
  'Não recomendamos decisões de compra, venda ou manutenção de ativos. Este assistente apresenta informações públicas, não recomendação de investimento. Consulte as fontes abaixo para ver os dados disponíveis.';

// Verbos de recomendação na primeira pessoa e construções de conselho de investimento.
// Os limites de palavra usam \p{L} em vez de \b porque \b não entende acentos.
const LINGUAGEM_RECOMENDATORIA: RegExp[] = [
  /(?<!\p{L})(recomendo|recomendamos|recomendaria|recomendaríamos|sugiro|sugerimos|sugeriria|sugeriríamos|aconselho|aconselhamos|aconselharia|aconselharíamos)(?!\p{L})/iu,
  /vale a pena (comprar|vender|manter|investir)/iu,
  /(é|seria|parece) (uma |um )?(boa|ótima|excelente|bom|ótimo) (hora|oportunidade|momento|negócio) (de|para) (comprar|vender|investir|entrar|sair)/iu,
  /(?<!\p{L})(compre|venda|mantenha|invista)\s+((as|a|os|o|suas|sua|seus|seu|em)\s+)?(ações|ação|papéis|papel|posição|posições)(?!\p{L})/iu,
];

export function contemLinguagemRecomendatoria(texto: string): boolean {
  return LINGUAGEM_RECOMENDATORIA.some((padrao) => padrao.test(texto));
}

function rotulo(doc: DocumentoRecuperado): string {
  return doc.origem === 'cvm'
    ? `${doc.ticker} · ${doc.period} (data-base ${doc.periodEnd})`
    : doc.title;
}

// Uma linha por documento. Na CVM, todos os trimestres de um ano vêm do mesmo ZIP, então
// a chave de duplicidade é ticker + período; na web, a URL da página.
export function formatarFontes(documentos: DocumentoRecuperado[]): string {
  const vistas = new Set<string>();
  const linhas: string[] = [];

  for (const doc of documentos) {
    const chave = doc.origem === 'cvm' ? `cvm:${doc.ticker}:${doc.period}` : `web:${doc.sourceUrl}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    linhas.push(`- ${rotulo(doc)} — ${doc.sourceUrl}`);
  }

  return linhas.length === 0 ? '' : `\n\nFontes:\n${linhas.join('\n')}`;
}

export function formatarResposta(texto: string, documentos: DocumentoRecuperado[]): string {
  const corpo = contemLinguagemRecomendatoria(texto) ? AVISO_GUARDRAIL : texto.trim();
  return `${corpo}${formatarFontes(documentos)}`;
}
