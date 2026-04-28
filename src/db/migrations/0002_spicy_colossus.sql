CREATE TABLE "eligibility_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"flags" jsonb NOT NULL,
	"reasoning" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eligibility_results_score_range" CHECK ("eligibility_results"."score" >= 0 AND "eligibility_results"."score" <= 100)
);
--> statement-breakpoint
CREATE TABLE "strategy_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model_used" text NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"narrative" text NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eligibility_results" ADD CONSTRAINT "eligibility_results_report_id_strategy_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."strategy_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_results" ADD CONSTRAINT "eligibility_results_program_id_funding_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."funding_programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_reports" ADD CONSTRAINT "strategy_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eligibility_results_report_id_idx" ON "eligibility_results" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "strategy_reports_project_id_idx" ON "strategy_reports" USING btree ("project_id");