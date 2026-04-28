import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { strategy_reports } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getProject } from "@/server/projects";
import { StrategyRun } from "./StrategyRun";
import ReactMarkdown from "react-markdown";

export default async function StrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const reports = await db
    .select()
    .from(strategy_reports)
    .where(eq(strategy_reports.project_id, id))
    .orderBy(desc(strategy_reports.generated_at))
    .limit(1);
  const latest = reports[0] ?? null;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Strategy — {project.title}</h1>
        <StrategyRun projectId={id} hasReport={!!latest} />
      </div>

      {latest ? (
        <article className="prose prose-sm max-w-none">
          <p className="text-xs text-muted-foreground">
            Generated {new Date(latest.generated_at).toLocaleString()} · model: {latest.model_used}
          </p>
          <ReactMarkdown>{latest.narrative}</ReactMarkdown>
        </article>
      ) : (
        <p className="text-muted-foreground">No strategy generated yet. Click &ldquo;Generate strategy&rdquo; above.</p>
      )}
    </section>
  );
}
