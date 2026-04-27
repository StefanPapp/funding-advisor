CREATE TYPE "public"."equity_willingness" AS ENUM('none', 'minority', 'majority');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('idea', 'planning', 'active', 'seeking_funding', 'funded');--> statement-breakpoint
CREATE TYPE "public"."sme_class" AS ENUM('micro', 'small', 'medium', 'large', 'unknown');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" text NOT NULL,
	"trading_name" text,
	"country" text NOT NULL,
	"region" text,
	"founded_on" date,
	"legal_form" text,
	"employee_count" integer,
	"annual_revenue" numeric(14, 2),
	"balance_sheet_total" numeric(14, 2),
	"sme_classification" "sme_class" DEFAULT 'unknown' NOT NULL,
	"sectors" text[] DEFAULT '{}'::text[] NOT NULL,
	"narrative" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_country_iso2" CHECK (length("organizations"."country") = 2)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"status" "project_status" DEFAULT 'idea' NOT NULL,
	"trl" integer,
	"domain" text[] DEFAULT '{}'::text[] NOT NULL,
	"total_budget" numeric(14, 2),
	"funding_gap" numeric(14, 2),
	"currency" text DEFAULT 'EUR' NOT NULL,
	"timeline_start" date,
	"timeline_end" date,
	"duration_months" integer,
	"consortium_partners" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"equity_willingness" "equity_willingness",
	"narrative" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_trl_range" CHECK ("projects"."trl" IS NULL OR ("projects"."trl" BETWEEN 1 AND 9)),
	CONSTRAINT "projects_currency_iso" CHECK (length("projects"."currency") = 3)
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_organization_id_idx" ON "projects" USING btree ("organization_id");