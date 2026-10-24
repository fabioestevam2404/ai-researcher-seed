// Uma fonte citada, pronta para virar link: de onde veio, o período do dado e a URL.
export interface Citacao {
  rotulo: string;
  origem: string;
  dataBase: string | null;
  url: string;
}

export interface RespostaAnalisada {
  texto: string;
  citacoes: Citacao[];
}

export const ORIGEM_CVM = 'Base local (CVM)';

// A API anexa as fontes ao fim da resposta, sempre neste formato (ver formatarFontes no agente):
//
//   <texto>
//
//   Fontes:
//   - VALE · 3T25 (data-base 2025-09-30) — https://dados.cvm.gov.br/...zip
//   - Título da página — https://site.com/noticia
const SEPARADOR_FONTES = '\n\nFontes:\n';
const SEPARADOR_URL = ' — ';
const DATA_BASE = /\s*\(data-base (\d{4}-\d{2}-\d{2})\)$/;

function hostDaUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function lerCitacao(linha: string): Citacao | null {
  // O título de uma página web pode conter " — "; a URL é sempre o último pedaço.
  const corte = linha.lastIndexOf(SEPARADOR_URL);
  if (!linha.startsWith('- ') || corte === -1) return null;

  const rotuloCompleto = linha.slice(2, corte).trim();
  const url = linha.slice(corte + SEPARADOR_URL.length).trim();
  const dataBase = DATA_BASE.exec(rotuloCompleto);

  // Só o corpus da CVM tem data-base no rótulo; as páginas web levam o host como origem.
  return dataBase
    ? {
        rotulo: rotuloCompleto.replace(DATA_BASE, ''),
        origem: ORIGEM_CVM,
        dataBase: dataBase[1],
        url,
      }
    : { rotulo: rotuloCompleto, origem: hostDaUrl(url), dataBase: null, url };
}

// Separa o texto da resposta do bloco de fontes. Sem bloco, a resposta inteira é texto.
export function parseAnswer(answer: string): RespostaAnalisada {
  const inicio = answer.lastIndexOf(SEPARADOR_FONTES);
  if (inicio === -1) return { texto: answer.trim(), citacoes: [] };

  const linhas = answer.slice(inicio + SEPARADOR_FONTES.length).split('\n');
  return {
    texto: answer.slice(0, inicio).trim(),
    citacoes: linhas.map(lerCitacao).filter((c): c is Citacao => c !== null),
  };
}
