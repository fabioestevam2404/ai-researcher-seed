---
name: frontend-design
description: Use ao criar ou mudar a aparência do frontend (apps/web) — cores, tipografia, layout, bolhas, citações, painel do pipeline, disclaimer e campo de pergunta. Derivada do protótipo em docs/design/prototype/. Complementa a angular-component (estrutura e estado) e a oficial angular-developer (idiomas do framework).
---

# Visual do AI Researcher

Fonte: `docs/design/prototype/resposta-concluida.html` e `pergunta-em-andamento.html`. Em
dúvida sobre medida ou cor, abra o protótipo — ele é a referência, esta skill é o resumo.

Precedência: idioma do Angular (estilo de componente, encapsulamento, acessibilidade) vem da
skill oficial `angular-developer`. Esta skill decide só o que é deste projeto: a aparência.

## Regra que não se negocia: só ciano é cor de estado

- Ciano marca **estado**: etapa em execução, a etapa de busca web e o banner de fallback.
- Concluído é um check **neutro** (cor do texto). Pendente é um círculo **cinza**.
- **Verde e vermelho não existem** neste produto. Nem para lucro/prejuízo, nem para sucesso/erro
  do pipeline. Um número negativo é só um número: `R$ -497,0 milhões`, na cor do texto.
- Motivo: colorir dado financeiro sugere julgamento ("bom", "ruim") — perto demais de
  recomendação, que o sistema não faz.

## Tokens

Definidos uma vez em `apps/web/src/styles.scss` como custom properties; componentes usam só os
tokens, nunca o hexadecimal.

| Token | Valor | Uso |
|---|---|---|
| `--cor-fundo` | `#F6F7F9` | fundo da página |
| `--cor-superficie` | `#FFFFFF` | header, disclaimer, cartões, campo |
| `--cor-borda` | `#E3E6EB` | bordas de cartão e separadores do layout |
| `--cor-borda-forte` | `#CDD2DA` | borda do campo de pergunta |
| `--cor-divisor` | `#EEF0F3` | divisória interna (antes das fontes) |
| `--cor-texto` | `#16191F` | texto principal, bolha do usuário, botão, check concluído |
| `--cor-texto-2` | `#3A404B` | texto do disclaimer |
| `--cor-texto-suave` | `#5B6270` | legendas, durações, origem e data-base das citações |
| `--cor-pendente` | `#9AA1AD` | círculo de etapa pendente (decorativo) |
| `--cor-desabilitado` | `#D5D9E0` | fundo do botão desabilitado |
| `--cor-estado` | `#0B5566` | texto e ícone ciano (em execução, busca web, banner) |
| `--cor-estado-fundo` | `#E6F6FA` | fundo ciano claro |
| `--cor-estado-borda` | `#B9E3EE` | borda do banner |
| `--cor-link` / `--cor-link-hover` | `#0E6A80` / `#0A4F60` | links |
| `--fonte-texto` | IBM Plex Sans | todo o texto |
| `--fonte-mono` | IBM Plex Mono | durações e datas (alinham melhor) |
| `--raio-bolha` `--raio-cartao` `--raio-controle` `--raio-item` | 16 / 14 / 10 / 8 px | |
| `--largura-maxima` | 1240px | header, disclaimer e conteúdo |

Corpo 15px/1.65 nas respostas, 14px no painel e nas citações, 12–13px em legendas.

## Layout

1. **Header** (superfície, borda inferior): marca "AI Researcher" + subtítulo "Indicadores de 20
   empresas da B3 · dados da CVM"; navegação Chat / Health à direita.
2. **Disclaimer** logo abaixo, em faixa própria, em **todas** as rotas: ícone de informação +
   "Este assistente apresenta informações públicas, não recomendação de investimento."
   Sem botão de fechar, sem `@if`, `role="note"`.
3. **Conteúdo**: linha com `flex-wrap`. Conversa `flex: 999 1 560px`; painel do pipeline
   `flex: 1 1 320px`. Em tela estreita o painel desce para baixo da conversa.

## Componentes

- **Bolha do usuário**: à direita, fundo `--cor-texto`, texto branco, raio `16 16 4 16`,
  largura até 75%.
- **Resposta**: à esquerda, cartão branco com borda, raio `16 16 16 4`, até 85%. Ordem interna:
  banner (se houve busca web) → texto → "FONTES" (rótulo pequeno em caixa alta) → citações.
- **Aguardando**: cartão pequeno à esquerda com três pontos pulsando e uma frase curta.
- **Banner de fallback**: fundo `--cor-estado-fundo`, borda `--cor-estado-borda`, texto
  `--cor-estado`, ícone de globo. É caminho normal, não erro — o texto explica, não alarma.
- **Citação**: um `<a>` por fonte, bordado, abre a fonte em nova aba. Mostra rótulo (peso 500),
  origem ("Base local (CVM)" ou o host), data-base em mono quando houver, "abrir fonte ↗".
- **Painel do pipeline**: cartão com título "Pipeline" e contador de iterações. Uma linha por
  etapa, na ordem em que aconteceram — repetir retrieve/grade no loop é o ponto da aula.
  Concluída: check neutro + duração em mono (`12,1 s`). Em execução: spinner ciano, fundo ciano
  claro, "em execução". Pendente: círculo cinza, "pendente". A linha de busca web fica em
  ciano também depois de concluída. O nó `webSearch` aparece como "search".
- **Campo de pergunta**: cartão com `textarea` sem borda própria e botão "Enviar" (≥44px de
  altura). Enter envia, Shift+Enter quebra linha; legenda abaixo diz isso. Desabilitado (campo
  vazio ou resposta em andamento): fundo `--cor-desabilitado`, texto suave, `cursor:
  not-allowed` — o visual muda junto com o atributo.

## Acessibilidade e movimento

- `<button>`, `<a href>`, `<textarea>` com `<label>` (visualmente oculto) — nunca `div` clicável.
- Ícone com significado: `role="img"` + `aria-label` (Concluída, Em execução, Pendente);
  decorativo: `aria-hidden="true"`.
- Resposta em andamento numa região `aria-live="polite"`.
- Spinner e pontos param com `prefers-reduced-motion: reduce`.
- Sem emoji. Ícones em SVG de traço, herdando a cor do token.
