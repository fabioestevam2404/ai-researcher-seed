CREATE TABLE "documentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"company_name" text NOT NULL,
	"setor" text NOT NULL,
	"period" text NOT NULL,
	"period_end" date NOT NULL,
	"receita_liquida" bigint,
	"lucro_bruto" bigint,
	"lucro_liquido" bigint,
	"ativo_total" bigint,
	"patrimonio_liquido" bigint,
	"caixa_operacional" bigint,
	"source_url" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"paragraph" text NOT NULL,
	"embedding" vector(768) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_ticker_period_idx" ON "documentos" USING btree ("ticker","period");--> statement-breakpoint
CREATE INDEX "documentos_embedding_idx" ON "documentos" USING hnsw ("embedding" vector_cosine_ops);