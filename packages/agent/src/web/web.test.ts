import { describe, expect, it } from 'vitest';
import { dividirEmChunks } from './dividir-em-chunks.js';
import { extrairTexto } from './extrair-texto.js';

describe('extrairTexto', () => {
  it('remove tags, scripts, estilos e comentários, mantendo o texto', () => {
    const html = `<html><head><title>x</title><style>p{color:red}</style></head>
      <body><!-- menu --><script>track()</script>
      <h1>Fato relevante</h1><p>A Vale&nbsp;informa &amp; esclarece.</p></body></html>`;

    expect(extrairTexto(html)).toBe('Fato relevante A Vale informa & esclarece.');
  });

  it('descarta menu, cabeçalho e rodapé, que são navegação e não conteúdo', () => {
    const html = `<header>Logo</header><nav><a>Estágio</a><a>Carreiras</a></nav>
      <main><p>A Vale comunica fato relevante.</p></main><footer>Termos</footer>`;

    expect(extrairTexto(html)).toBe('A Vale comunica fato relevante.');
  });

  it('decodifica entidades numéricas e normaliza espaços', () => {
    expect(extrairTexto('<p>Receita&#32;&#32;   l&#237;quida</p>\n\n')).toBe('Receita líquida');
  });
});

describe('dividirEmChunks', () => {
  it('texto curto vira um único chunk', () => {
    expect(dividirEmChunks('abc', 1000, 100)).toEqual(['abc']);
  });

  it('chunks de tamanho fixo com sobreposição entre vizinhos', () => {
    const texto = 'abcdefghij'; // 10 caracteres, chunks de 4 com 1 de sobreposição

    expect(dividirEmChunks(texto, 4, 1)).toEqual(['abcd', 'defg', 'ghij']);
  });

  it('com o padrão de 1000/100, o fim de um chunk repete no começo do próximo', () => {
    const texto = 'x'.repeat(950) + 'FIM-DO-CHUNK' + 'y'.repeat(1500);
    const [primeiro, segundo] = dividirEmChunks(texto);

    expect(primeiro).toHaveLength(1000);
    expect(segundo.startsWith(primeiro.slice(-100))).toBe(true);
  });

  it('recusa sobreposição maior ou igual ao tamanho, que nunca terminaria', () => {
    expect(() => dividirEmChunks('abc', 10, 10)).toThrow();
  });
});
