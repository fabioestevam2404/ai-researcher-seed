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

// O prompt pede ao modelo uma última linha "Fontes usadas: 1, 3" com os números dos documentos
// do contexto que ele usou. Esta função tira a linha do texto e devolve os números válidos.
// Sem a linha, ou só com números inválidos, devolve null: na dúvida, todas as fontes ficam.
const LINHA_FONTES_USADAS = /\n*\s*Fontes usadas:\s*([^\n]*)\s*$/i;

export function separarFontesUsadas(
  texto: string,
  totalDocumentos: number,
): { corpo: string; indices: number[] | null } {
  const encontrada = LINHA_FONTES_USADAS.exec(texto);
  if (!encontrada) return { corpo: texto.trim(), indices: null };

  const corpo = texto.slice(0, encontrada.index).trim();
  const indices = (encontrada[1].match(/\d+/g) ?? [])
    .map(Number)
    .filter((n) => n >= 1 && n <= totalDocumentos)
    .map((n) => n - 1);

  return { corpo, indices: indices.length > 0 ? indices : null };
}

export function formatarResposta(texto: string, documentos: DocumentoRecuperado[]): string {
  const { corpo, indices } = separarFontesUsadas(texto, documentos.length);

  // Recomendação detectada: a resposta inteira vira o aviso, e as fontes são todas as
  // recuperadas — o usuário pode consultar os dados por conta própria.
  if (contemLinguagemRecomendatoria(corpo)) {
    return `${AVISO_GUARDRAIL}${formatarFontes(documentos)}`;
  }

  // Só as fontes que o modelo disse ter usado; sem essa informação, todas.
  const usadas = indices ? documentos.filter((_, i) => indices.includes(i)) : documentos;
  return `${corpo}${formatarFontes(usadas)}`;
}
