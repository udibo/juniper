CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
