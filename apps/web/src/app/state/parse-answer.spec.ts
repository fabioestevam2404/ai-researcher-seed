import { ORIGEM_CVM, parseAnswer } from './parse-answer';

const ZIP = 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip';

describe('parseAnswer', () => {
  it('separa o texto das fontes e lê a citação da CVM com origem e data-base', () => {
    const resposta = parseAnswer(
      `A receita da Vale foi de R$ 56,7 bilhões no 3T25.\n\nFontes:\n- VALE · 3T25 (data-base 2025-09-30) — ${ZIP}`,
    );

    expect(resposta.texto).toBe('A receita da Vale foi de R$ 56,7 bilhões no 3T25.');
    expect(resposta.citacoes).toEqual([
      { rotulo: 'VALE · 3T25', origem: ORIGEM_CVM, dataBase: '2025-09-30', url: ZIP },
    ]);
  });

  it('página web leva o host como origem e não tem data-base', () => {
    const { citacoes } = parseAnswer(
      'Texto.\n\nFontes:\n- Vale divulga resultados — https://www.vale.com/pt/noticia?id=1',
    );

    expect(citacoes).toEqual([
      {
        rotulo: 'Vale divulga resultados',
        origem: 'www.vale.com',
        dataBase: null,
        url: 'https://www.vale.com/pt/noticia?id=1',
      },
    ]);
  });

  it('título com travessão não confunde a URL', () => {
    const { citacoes } = parseAnswer(
      'Texto.\n\nFontes:\n- Vale — fato relevante — https://ex.com/a',
    );

    expect(citacoes[0]).toMatchObject({ rotulo: 'Vale — fato relevante', url: 'https://ex.com/a' });
  });

  it('resposta sem bloco de fontes é só texto', () => {
    expect(parseAnswer('  Sem fontes.  ')).toEqual({ texto: 'Sem fontes.', citacoes: [] });
  });

  it('mantém a ordem e o número de linhas de várias fontes', () => {
    const { citacoes } = parseAnswer(
      `Texto.\n\nFontes:\n- VALE · 3T25 (data-base 2025-09-30) — ${ZIP}\n- Notícia — https://ex.com/n`,
    );

    expect(citacoes.map((c) => c.origem)).toEqual([ORIGEM_CVM, 'ex.com']);
  });
});
