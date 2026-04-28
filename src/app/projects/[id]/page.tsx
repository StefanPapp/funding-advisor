import { notFound } from "next/navigation";
import Link from "next/link";
import { getProject, updateProject, deleteProject } from "@/server/projects";
import { listOrgs, getOrg } from "@/server/orgs";
import { quickMatch } from "@/server/match";
import { ProjectForm } from "@/components/master-data/ProjectForm";
import { Button } from "@/components/ui/button";
import type { ProjectInsert } from "@/domain/schemas";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const [orgs, parent] = await Promise.all([listOrgs(), getOrg(project.organization_id)]);
  const matches = parent ? await quickMatch(parent, project) : [];

  async function update(data: ProjectInsert) {
    "use server";
    await updateProject(id, data);
  }

  async function remove() {
    "use server";
    await deleteProject(id);
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{project.title}</h1>
        <form action={remove}>
          <Button type="submit" variant="destructive">
            Delete
          </Button>
        </form>
      </div>
      {parent && (
        <p className="text-sm text-muted-foreground">
          Belongs to{" "}
          <Link href={`/orgs/${parent.id}`} className="underline">
            {parent.legal_name}
          </Link>
        </p>
      )}
      <ProjectForm
        orgs={orgs.map((o) => ({ id: o.id, legal_name: o.legal_name }))}
        initial={{
          organization_id: project.organization_id,
          title: project.title,
          summary: project.summary ?? undefined,
          status: project.status,
          trl: project.trl ?? undefined,
          domain: project.domain ?? [],
          total_budget: project.total_budget ?? undefined,
          funding_gap: project.funding_gap ?? undefined,
          currency: project.currency,
          equity_willingness: project.equity_willingness ?? undefined,
          consortium_partners: (project.consortium_partners as never) ?? [],
          narrative: project.narrative ?? undefined,
        }}
        action={update}
        submitLabel="Save changes"
      />
      <section>
        <h2 className="text-xl font-semibold mb-2">Quick match — top 10 (deterministic)</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No eligible programs in the catalog. Fill in country, TRL, funding gap, and (for equity) equity willingness on this project to expand the search.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Program</th>
                <th>Kind</th>
                <th>Score</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {matches.slice(0, 10).map((m) => (
                <tr key={m.program_id} className="border-b">
                  <td className="py-2">
                    <Link href={`/catalog/${m.program_id}`} className="hover:underline">
                      {m.program.program_name}
                    </Link>
                    <span className="text-xs text-muted-foreground"> — {m.program.provider}</span>
                  </td>
                  <td>{m.program.kind}</td>
                  <td>{m.score}</td>
                  <td className="text-xs">
                    {Object.entries(m.flags)
                      .filter(([, v]) => v !== "pass")
                      .map(([k, v]) => `${k}:${v}`)
                      .join(" · ") || "all pass"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
