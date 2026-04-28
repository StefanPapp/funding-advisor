CREATE TYPE "public"."interview_subject_type" AS ENUM('org', 'project');--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "interview_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"current_question_id" text,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extracted_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "interview_sessions_subject_idx" ON "interview_sessions" USING btree ("subject_type","subject_id");