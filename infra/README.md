# Infra — Bloco A (Fundação GCP)

Recursos GCP provisionados no Bloco A, fora do controle de versão (não há Terraform/IaC ainda — isso é conteúdo de bloco futuro, se entrar no escopo). Este arquivo documenta o que existe e como foi criado, para reprodução manual.

## Recursos criados

| Recurso | Valor |
|---|---|
| Projeto GCP | `ai-researcher-capstone` |
| Região padrão | `us-central1` (escolhida pela cobertura de modelos Gemini estáveis no Vertex AI; `southamerica-east1` tem cobertura mais restrita) |
| Billing account | `<billing-account-do-aluno>` |
| Artifact Registry | repo Docker `ai-researcher` em `us-central1` |
| Cloud SQL | instância `ai-researcher-db`, Postgres 16, tier `db-f1-micro` (menor tier suportado em Postgres via edição Enterprise), zonal, sem backup automático, IP público |
| Banco | `ai_researcher`, extensão `vector` (pgvector 0.8.1) habilitada |
| Usuário da aplicação | `app_user`, credenciais apenas no Secret Manager |
| Secret Manager | `database-url` — connection string do `app_user`, via socket Unix (`?host=/cloudsql/...`), formato que o Cloud Run usa em produção (C.6). Localmente o `docker-compose` usa uma `DATABASE_URL` própria, TCP direto pro Postgres do compose — nunca lê este secret. |
| Workload Identity Federation | pool `github-actions-pool`, provider `github-actions-provider`, restrito ao repositório `unipds-engenharia-de-ia-aplicada/capstone-project-ai-researcher` via `attribute.repository` |
| Service account de deploy | `github-actions-deployer@ai-researcher-capstone.iam.gserviceaccount.com` — roles: `run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser`, `cloudsql.client`, `secretmanager.secretAccessor`, `cloudbuild.builds.editor`, `firebasehosting.admin` (esta última adicionada no C.5, pro `firebase deploy --only hosting` do workflow) |
| Firebase Hosting | inicializado no projeto; placeholder do A.6 substituído pelo `firebase.json` versionado e pelo build real do Angular a partir do C.5 |

Nenhuma credencial foi escrita em arquivo local ou versionado — a senha do `app_user` e a connection string só existem no Secret Manager.

## Para o workflow do GitHub Actions (Bloco C.4)

O `google-github-actions/auth` action vai precisar de:

```yaml
workload_identity_provider: projects/473939301392/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider
service_account: github-actions-deployer@ai-researcher-capstone.iam.gserviceaccount.com
```

## Bloco C — Deploy Zero

Primeiro deploy real (`v1`) rodou verde ponta a ponta em `2026-08-08`: `apps/api` no Cloud Run (`ai-researcher-api`, `us-central1`) e `apps/web` no Firebase Hosting, via `.github/workflows/deploy.yml` autenticado por WIF.

Três problemas só apareceram rodando o workflow de verdade contra produção (não em teoria) — os três documentados nos commits do Bloco C:

1. O bucket de staging padrão do Cloud Build (`gs://ai-researcher-capstone_cloudbuild`, criado com ACL legada na primeira vez que rodei `gcloud builds submit` manualmente no A.2) recusava acesso da service account de deploy mesmo depois de IAM binding no bucket e `serviceusage.serviceUsageConsumer` no projeto. Resolvido trocando a etapa de build por `docker build` + `docker push` direto no runner do GitHub Actions, sem depender do Cloud Build.
2. A service account **de execução** do Cloud Run (`473939301392-compute@developer.gserviceaccount.com`, a padrão do Compute — diferente da service account *de deploy*) precisou de `secretmanager.secretAccessor` no secret `database-url` pra conseguir ler o próprio segredo em runtime.
3. `pnpm --filter @hero/web build` no job de deploy pulava o Turborepo e nunca buildava `@hero/contracts` primeiro — corrigido usando `pnpm turbo run build --filter=@hero/web`, que respeita `dependsOn: ["^build"]`.

**Pendência conhecida, decisão deliberada:** o Cloud Run **não está público** — `gcloud run services add-iam-policy-binding ... --member=allUsers --role=roles/run.invoker` foi proposto e recusado (a exposição pra internet inteira merece confirmação explícita, não só seguir o plano). Efeito prático: `/api/health` responde 403 tanto direto no Cloud Run quanto via rewrite do Firebase Hosting; `capstone:check` item 1 falha até isso ser decidido. Rodar o comando acima quando a decisão for tomada — nada mais no pipeline depende disso.

## A.7 — Cronometragem

Tempo do zero (conta com billing já configurado, mas máquina limpa — sem `gcloud`, sem `psql`, sem componente `cloud-sql-proxy`) até A.6 concluído: **~30 minutos**.

Isso ultrapassa o orçamento de 20 minutos para caber ao vivo na Unidade 1. Distribuição aproximada do tempo:

- Instalação de ferramental local (gcloud CLI, libpq/psql, componente cloud-sql-proxy): a maior parte do tempo, e é o que menos agrega à aula — é setup de máquina, não decisão de arquitetura.
- Dois logins interativos distintos (`gcloud auth login` e `gcloud auth application-default login`) — a segunda conta muita gente esquece, e o erro que ela produz (`could not find default credentials`) não é óbvio.
- Provisionamento em si (criar projeto, habilitar APIs, Artifact Registry, Cloud SQL, WIF, Firebase) — rápido, a maior parte em paralelo/background.

**Recomendação:** Bloco A vira pré-requisito assíncrono, não demonstração ao vivo. O aluno provisiona a própria conta GCP antes da Unidade 1, seguindo este README como roteiro; a aula usa o tempo para explicar *por que* cada peça existe (WIF em vez de chave de service account, `db-f1-micro` vs. tiers maiores, região por cobertura de modelo) em vez de esperar comandos rodarem.
