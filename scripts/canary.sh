#!/usr/bin/env bash
# Deploy gradual da API no Cloud Run (RNF-09). Usado pelo .github/workflows/deploy.yml em
# dois momentos:
#
#   scripts/canary.sh estavel             antes do deploy: imprime a revisão com 100% do tráfego
#   scripts/canary.sh promover <estavel>  depois do deploy --no-traffic --tag=candidata
#
# "promover" faz o smoke na URL da candidata e sobe o tráfego em degraus (5, 25, 50, 100%).
# Cada degrau tem um gate; se qualquer passo falhar, 100% volta para a revisão estável e o
# script sai com erro — o frontend nem chega a ser publicado.
#
# Variáveis: SERVICE, REGION, PROJECT_ID (obrigatórias); GATE_REQUISICOES (padrão 100);
# FORCAR_FALHA_GATE=true faz o primeiro gate reprovar, para exercitar o rollback (T096).
set -euo pipefail

: "${SERVICE:?}" "${REGION:?}" "${PROJECT_ID:?}"
GATE_REQUISICOES="${GATE_REQUISICOES:-100}"
FORCAR_FALHA_GATE="${FORCAR_FALHA_GATE:-false}"
TAG=candidata
DEGRAUS=(5 25 50 100)

servico_json() {
  gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT_ID" --format=json
}

# Revisão que hoje serve 100% do tráfego: é para ela que o rollback volta.
revisao_estavel() {
  servico_json | jq -r '.status.traffic[] | select(.percent == 100 and .revisionName) | .revisionName'
}

# Smoke barato, sem LLM: health com banco ok e o chat recusando corpo vazio com 400.
# Cada checagem tem "|| return 1" explícito: quando a função é chamada em "smoke ... || rollback",
# o bash desliga o set -e dentro dela, e uma falha no meio passaria despercebida.
smoke() {
  local url="$1" codigo
  curl -fsS "$url/api/health" | jq -e '.status == "ok" and .database == "ok"' >/dev/null \
    || { echo "smoke: health falhou em $url"; return 1; }
  codigo=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$url/api/chat" \
    -H 'Content-Type: application/json' -d '{}') || return 1
  [ "$codigo" = 400 ] || { echo "smoke: chat respondeu $codigo, esperado 400"; return 1; }
  echo "smoke: ok em $url"
}

# Gate de um degrau: N requisições ao health pela URL principal. Conta as que a candidata
# atendeu (cabeçalho x-revisao) e as que falharam nela. Ausência de dados não aprova: se a
# candidata não atendeu nenhuma, o degrau reprova.
gate() {
  local url="$1" candidata="$2" atendidas=0 falhas=0
  local cabecalhos corpo codigo revisao
  cabecalhos=$(mktemp) corpo=$(mktemp)

  for _ in $(seq 1 "$GATE_REQUISICOES"); do
    codigo=$(curl -s -D "$cabecalhos" -o "$corpo" -w '%{http_code}' "$url/api/health" || true)
    revisao=$(grep -i '^x-revisao:' "$cabecalhos" | tr -d '\r' | awk '{print $2}' || true)
    if [ "$revisao" = "$candidata" ]; then
      atendidas=$((atendidas + 1))
      if [ "$codigo" != 200 ] || ! jq -e '.database == "ok"' "$corpo" >/dev/null 2>&1; then
        falhas=$((falhas + 1))
      fi
    fi
  done
  rm -f "$cabecalhos" "$corpo"

  echo "gate: candidata atendeu $atendidas de $GATE_REQUISICOES, com $falhas falha(s)"
  [ "$FORCAR_FALHA_GATE" != true ] || { echo "gate: falha forçada (FORCAR_FALHA_GATE)"; return 1; }
  [ "$atendidas" -ge 1 ] && [ "$falhas" -eq 0 ]
}

trafego() {
  gcloud run services update-traffic "$SERVICE" --region="$REGION" --project="$PROJECT_ID" \
    --to-revisions="$1" --quiet >/dev/null
}

rollback() {
  local estavel="$1" url="$2"
  echo "::error::Canary reprovado — devolvendo 100% do tráfego para $estavel"
  trafego "$estavel=100"
  smoke "$url" && echo "rollback: revisão estável respondendo" || echo "::error::smoke falhou após o rollback"
  exit 1
}

promover() {
  local estavel="$1" json candidata url_tag url
  json=$(servico_json)
  candidata=$(jq -r --arg t "$TAG" '.status.traffic[] | select(.tag == $t) | .revisionName' <<<"$json")
  url_tag=$(jq -r --arg t "$TAG" '.status.traffic[] | select(.tag == $t) | .url' <<<"$json")
  url=$(jq -r '.status.url' <<<"$json")
  echo "estável: $estavel | candidata: $candidata"

  [ "$candidata" != "$estavel" ] || { echo "::error::candidata igual à estável"; exit 1; }

  echo "smoke na URL da candidata ($url_tag)"
  smoke "$url_tag" || rollback "$estavel" "$url"

  for percentual in "${DEGRAUS[@]}"; do
    if [ "$percentual" -eq 100 ]; then
      trafego "$candidata=100"
    else
      trafego "$candidata=$percentual,$estavel=$((100 - percentual))"
    fi
    echo "degrau: $percentual% na candidata"
    gate "$url" "$candidata" || rollback "$estavel" "$url"
  done

  echo "promovida: $candidata com 100% do tráfego"
}

case "${1:-}" in
  estavel) revisao_estavel ;;
  promover) promover "${2:?informe a revisão estável}" ;;
  *) echo "uso: $0 estavel | promover <revisao-estavel>" >&2; exit 2 ;;
esac
