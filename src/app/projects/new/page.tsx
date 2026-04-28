import { ProjectForm } from "@/components/master-data/ProjectForm";
import { createProject } from "@/server/projects";
import { listOrgs } from "@/server/orgs";
import type { ProjectInsert } from "@/domain/schemas";

// Always read live orgs — otherwise the org dropdown is frozen to deploy-time state.
export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const orgs = (await listOrgs()).map((o) => ({ id: o.id, legal_name: o.legal_name }));

  async function action(data: ProjectInsert) {
    "use server";
    const id = await createProject(data);
    return { id };
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">New project</h1>
      <ProjectForm orgs={orgs} action={action} submitLabel="Create" />
    </section>
  );
}
