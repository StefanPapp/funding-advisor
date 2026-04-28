import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrg, updateOrg, deleteOrg } from "@/server/orgs";
import { OrgForm } from "@/components/master-data/OrgForm";
import { listProjects } from "@/server/projects";
import { Button } from "@/components/ui/button";
import type { OrgInsert } from "@/domain/schemas";

export default async function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getOrg(id);
  if (!org) notFound();
  const projects = await listProjects({ organization_id: id });

  async function update(data: OrgInsert) {
    "use server";
    await updateOrg(id, data);
  }

  async function remove() {
    "use server";
    await deleteOrg(id);
  }

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{org.legal_name}</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/orgs/${id}/interview`}>Deep-dive interview</Link>
          </Button>
          <form action={remove}>
            <Button type="submit" variant="destructive">
              Delete
            </Button>
          </form>
        </div>
      </div>

      <OrgForm
        initial={{
          legal_name: org.legal_name,
          trading_name: org.trading_name ?? undefined,
          country: org.country,
          region: org.region ?? undefined,
          legal_form: org.legal_form ?? undefined,
          employee_count: org.employee_count ?? undefined,
          annual_revenue: org.annual_revenue ?? undefined,
          balance_sheet_total: org.balance_sheet_total ?? undefined,
          sectors: org.sectors ?? [],
          narrative: org.narrative ?? undefined,
        }}
        action={update}
        submitLabel="Save changes"
      />

      <div>
        <h2 className="text-xl font-semibold mb-2">Projects</h2>
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="hover:underline">
                {p.title}
              </Link>{" "}
              <span className="text-sm text-muted-foreground">({p.status})</span>
            </li>
          ))}
          {projects.length === 0 && <li className="text-muted-foreground">None yet.</li>}
        </ul>
      </div>
    </section>
  );
}
