# Protótipo do chat

Duas telas, desenhadas num canvas de design do claude.ai e exportadas aqui como HTML standalone
(abra no navegador, sem build). São a referência visual da Fase 7 e a fonte da skill
`.claude/skills/frontend-design/`.

| Arquivo | Estado mostrado |
|---|---|
| `resposta-concluida.html` | Resposta pronta depois do loop com busca web: banner ciano, citações da CVM e da web, painel com as 6 etapas e durações. |
| `pergunta-em-andamento.html` | Grafo trabalhando: retrieve concluído, grade em execução, answer pendente, botão de envio desabilitado. |

Os números vêm do corpus da CVM e as durações de execuções reais do grafo. O motivo do prejuízo
da Klabin é a fixture fictícia do modo demo, marcada `[DEMO]` na fonte.
