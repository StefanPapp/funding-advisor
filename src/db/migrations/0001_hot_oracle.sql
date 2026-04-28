CREATE TYPE "public"."program_confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."program_kind" AS ENUM('grant', 'equity', 'debt', 'alternative');--> statement-breakpoint
CREATE TYPE "public"."program_source" AS ENUM('seed', 'llm_research');--> statement-breakpoint
CREATE TABLE "funding_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "program_kind" NOT NULL,
	"provider" text NOT NULL,
	"program_name" text NOT NULL,
	"url" text,
	"geography_scope" jsonb NOT NULL,
	"sectors" text[] DEFAULT '{}'::text[] NOT NULL,
	"domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"min_amount" numeric(14, 2),
	"max_amount" numeric(14, 2),
	"typical_amount" numeric(14, 2),
	"currency" text DEFAULT 'EUR' NOT NULL,
	"eligibility_rules" jsonb NOT NULL,
	"application_deadline" date,
	"source" "program_source" NOT NULL,
	"last_verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confidence" "program_confidence" DEFAULT 'medium' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funding_programs_currency_iso" CHECK (length("funding_programs"."currency") = 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "funding_programs_provider_program_name_uq" ON "funding_programs" USING btree ("provider","program_name");--> statement-breakpoint
CREATE INDEX "funding_programs_kind_idx" ON "funding_programs" USING btree ("kind");