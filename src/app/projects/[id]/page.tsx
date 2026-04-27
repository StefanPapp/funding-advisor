import { notFound } from "next/navigation";
import Link from "next/link";
import { getProject, updateProject, deleteProject } from "@/server/projects";
import { listOrgs, getOrg } from "@/server/orgs";
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
    </section>
  );
}
