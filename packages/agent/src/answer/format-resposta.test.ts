import { describe, expect, it } from 'vitest';
import type { DocumentoRecuperado } from '../documento.js';
import {
  AVISO_GUARDRAIL,
  contemLinguagemRecomendatoria,
  formatarFontes,
  formatarResposta,
} from './format-resposta.js';

const cvm = (ticker: string, period: string, periodEnd: string): DocumentoRecuperado => ({
  origem: 'cvm',
  ticker,
  companyName: `${ticker} S.A.`,
  period,
  periodEnd,
  content: '...',
  sourceUrl: 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip',
  similaridade: 0.9,
});

const web: DocumentoRecuperado = {
  origem: 'web',
  title: 'Vale divulga fato relevante',
  content: '...',
  sourceUrl: 'https://vale.com/fato',
  fetchedAt: '2026-10-23T12:00:00.000Z',
  similaridade: 0.8,
};

describe('contemLinguagemRecomendatoria', () => {
  it.each([
    'Eu recomendo comprar PETR4 agora.',
    'Recomendaríamos manter a posição.',
    'Sugiro aguardar o próximo balanço antes de entrar.',
    'Nós aconselhamos cautela com o papel.',
    'Com esses números, vale a pena comprar Vale.',
    'Parece uma boa hora para comprar.',
    'Seria uma ótima oportunidade de investir.',
    'Compre as ações enquanto estão baratas.',
    'Mantenha sua posição.',
    'Compre o papel na queda.',
    'Venda ações da empresa antes do resultado.',
  ])('bloqueia: "%s"', (texto) => {
    expect(contemLinguagemRecomendatoria(texto)).toBe(true);
  });

  it.each([
    'No 3T25, a Vale reportou receita líquida de R$ 56,7 bilhões.',
    'A companhia anunciou a venda de ativos de níquel.',
    'O lucro caiu por causa da recomendação regulatória da ANEEL.',
    'Não é possível dar recomendação de investimento; os dados disponíveis são estes.',
  ])('deixa passar texto informativo: "%s"', (texto) => {
    expect(contemLinguagemRecomendatoria(texto)).toBe(false);
  });
});

describe('formatarFontes', () => {
  it('CVM cita ticker, período e data-base; web cita o título', () => {
    expect(formatarFontes([cvm('VALE', '3T25', '2025-09-30'), web])).toBe(
      '\n\nFontes:\n' +
        '- VALE · 3T25 (data-base 2025-09-30) — https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip\n' +
        '- Vale divulga fato relevante — https://vale.com/fato',
    );
  });

  it('não repete a mesma fonte, mas mantém trimestres diferentes do mesmo ZIP da CVM', () => {
    const fontes = formatarFontes([
      cvm('VALE', '3T25', '2025-09-30'),
      cvm('VALE', '3T25', '2025-09-30'),
      cvm('VALE', '2T25', '2025-06-30'),
      web,
      { ...web, content: 'outro chunk da mesma página' },
    ]);

    expect(fontes.split('\n').filter((linha) => linha.startsWith('- '))).toHaveLength(3);
  });

  it('sem documentos, sem bloco de fontes', () => {
    expect(formatarFontes([])).toBe('');
  });
});

describe('formatarResposta', () => {
  it('resposta informativa passa intacta, com as fontes anexadas', () => {
    const texto = 'A Vale reportou receita líquida de R$ 56,7 bilhões no 3T25.';

    expect(formatarResposta(texto, [cvm('VALE', '3T25', '2025-09-30')])).toBe(
      `${texto}${formatarFontes([cvm('VALE', '3T25', '2025-09-30')])}`,
    );
  });

  it('resposta recomendatória vira o aviso fixo, mas as fontes continuam', () => {
    const resultado = formatarResposta('Eu recomendo comprar VALE3 agora.', [
      cvm('VALE', '3T25', '2025-09-30'),
    ]);

    expect(resultado.startsWith(AVISO_GUARDRAIL)).toBe(true);
    expect(resultado).not.toContain('recomendo comprar');
    expect(resultado).toContain('VALE · 3T25 (data-base 2025-09-30)');
  });
});
