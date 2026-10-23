const ENTIDADES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

// Extrai o texto legível de uma página HTML. É deliberadamente simples: tira o que nunca é
// conteúdo (script, style, comentários) e o que é navegação (menu, cabeçalho, rodapé),
// remove as tags e normaliza os espaços. Para o RAG basta o texto corrido — não
// precisamos de um parser de DOM completo.
export function extrairTexto(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, (entidade) => ENTIDADES[entidade] ?? ' ')
    .replace(/&#(\d+);/g, (_, codigo: string) => String.fromCharCode(Number(codigo)))
    .replace(/\s+/g, ' ')
    .trim();
}
