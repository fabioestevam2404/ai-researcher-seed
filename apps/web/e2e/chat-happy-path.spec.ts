import { expect, test } from '@playwright/test';

const DISCLAIMER =
  'Este assistente apresenta informações públicas, não recomendação de investimento.';
const ZIP_CVM = 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2025.zip';

// CA-12: com a API em DEMO=true, a pergunta percorre o produto inteiro — campo, SSE, store,
// painel, revelação e citação — e a resposta é sempre a mesma.
test('pergunta sobre a Vale chega à resposta citada, com o painel em 3 etapas', async ({
  page,
}) => {
  await page.goto('/');
  const disclaimer = page.getByRole('note');
  await expect(disclaimer).toHaveText(DISCLAIMER);

  const campo = page.getByLabel('Pergunta');
  const enviar = page.getByRole('button', { name: 'Enviar' });
  await expect(enviar).toBeDisabled();

  await campo.fill('Qual foi a receita líquida da Vale no 3T25?');
  await expect(enviar).toBeEnabled();
  await campo.press('Enter');

  // A revelação palavra por palavra termina; o valor vem do documento real congelado.
  const resposta = page.locator('article.resposta');
  await expect(resposta.locator('.texto')).toContainText('R$ 56,7 bilhões');

  const citacao = resposta.getByRole('link', { name: /VALE · 3T25/ });
  await expect(citacao).toContainText('Base local (CVM)');
  await expect(citacao).toContainText('data-base 2025-09-30');
  await expect(citacao).toHaveAttribute('href', ZIP_CVM);

  // Caminho direto do grafo: retrieve → grade → answer, as três concluídas.
  const painel = page.getByRole('complementary', { name: 'Pipeline do agente' });
  await expect(painel.getByRole('listitem')).toHaveCount(3);
  await expect(painel.getByRole('img', { name: 'Concluída' })).toHaveCount(3);
  await expect(painel.getByRole('listitem').filter({ hasText: 'search' })).toHaveCount(0);

  // O aviso regulatório continua lá depois da resposta.
  await expect(disclaimer).toBeVisible();
});
