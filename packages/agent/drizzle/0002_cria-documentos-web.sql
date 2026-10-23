CREATE TABLE "documentos_web" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source_url" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"embedding" vector(768) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "documentos_web_embedding_idx" ON "documentos_web" USING hnsw ("embedding" vector_cosine_ops);