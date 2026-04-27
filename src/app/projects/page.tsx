import Link from "next/link";
import { listProjects } from "@/server/projects";
import { listOrgs } from "@/server/orgs";
import { Button } from "@/components/ui/button";

export default async function ProjectsPage() {
  const [projects, orgs] = await Promise.all([listProjects(), listOrgs()]);
  const orgById = new Map(orgs.map((o) => [o.id, o]));

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button asChild disabled={orgs.length === 0}>
          <Link href="/projects/new">New project</Link>
        </Button>
      </div>
      {orgs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Create an organization first.
        </p>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Title</th>
            <th>Org</th>
            <th>Status</th>
            <th>TRL</th>
            <th>Funding gap</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-b hover:bg-muted/40">
              <td className="py-2">
                <Link href={`/projects/${p.id}`} className="hover:underline">
                  {p.title}
                </Link>
              </td>
              <td>{orgById.get(p.organization_id)?.legal_name ?? "—"}</td>
              <td>{p.status}</td>
              <td>{p.trl ?? "—"}</td>
              <td>{p.funding_gap ?? "—"}</td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td className="py-4 text-muted-foreground" colSpan={5}>
                No projects yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
