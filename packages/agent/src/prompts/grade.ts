import type { DocumentoRecuperado } from '../documento.js';

// System prompt do nó grade. É um prompt interno: o usuário não vê nem altera. A regra de
// suficiência mora aqui — calibrá-la decide quanto o agente recorre à internet.
export const GRADE_SYSTEM_PROMPT = `Você avalia se um contexto recuperado de uma base vetorial é suficiente para responder a uma pergunta sobre empresas listadas na B3.

O contexto tem dois tipos de documento:
- [CVM]: APENAS indicadores financeiros numéricos (receita líquida, lucro bruto, lucro líquido, ativo total, patrimônio líquido e caixa operacional) por empresa e trimestre, de dados públicos da CVM. Não contêm notícias, fatos relevantes, motivos, explicações, guidance, projeções nem cotações.
- [WEB]: trechos de páginas da internet coletados em buscas anteriores, com título e data de coleta.

Regras:
1. Pergunta numérica é SUFICIENTE apenas quando o indicador aparece explicitamente no contexto, para a empresa e o período pedidos (ou, se a pergunta não indicar período, para algum período disponível da empresa).
2. Pergunta qualitativa (motivo por trás de um número, notícia, fato relevante, guidance, previsão de preço, cotação, opinião de mercado) NUNCA é respondida por documentos [CVM]. Ela só é SUFICIENTE se um trecho [WEB] tratar diretamente do que foi perguntado, para a empresa certa; caso contrário, é INSUFICIENTE, mesmo que haja documentos da empresa certa.
3. Se o indicador, a empresa ou o período pedidos não aparecem no contexto, é INSUFICIENTE. Nunca considere suficiente imaginando um número ou um fato que não está escrito no contexto.
4. Quando for insuficiente, liste em missingAspects o que falta, em termos curtos que sirvam de busca na web (ex.: "último fato relevante", "motivo da queda do lucro no 3T25"). Quando for suficiente, missingAspects é uma lista vazia.`;

function cabecalho(doc: DocumentoRecuperado): string {
  return doc.origem === 'cvm'
    ? `[CVM] ${doc.companyName} (${doc.ticker}) · ${doc.period}, data-base ${doc.periodEnd}`
    : `[WEB] ${doc.title} · coletado em ${doc.fetchedAt.slice(0, 10)} · ${doc.sourceUrl}`;
}

export function formatarContexto(documentos: DocumentoRecuperado[]): string {
  return documentos.map((doc, i) => `${i + 1}. ${cabecalho(doc)}\n${doc.content}`).join('\n\n');
}

export function gradePrompt({
  question,
  documents,
}: {
  question: string;
  documents: DocumentoRecuperado[];
}): Array<['system' | 'human', string]> {
  return [
    ['system', GRADE_SYSTEM_PROMPT],
    ['human', `Contexto recuperado:\n\n${formatarContexto(documents)}\n\nPergunta: ${question}`],
  ];
}
