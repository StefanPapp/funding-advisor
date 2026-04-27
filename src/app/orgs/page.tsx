import Link from "next/link";
import { listOrgs } from "@/server/orgs";
import { Button } from "@/components/ui/button";

export default async function OrgsPage() {
  const orgs = await listOrgs();
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <Button asChild>
          <Link href="/orgs/new">New organization</Link>
        </Button>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Name</th>
            <th>Country</th>
            <th>SME</th>
            <th>Employees</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((o) => (
            <tr key={o.id} className="border-b hover:bg-muted/40">
              <td className="py-2">
                <Link href={`/orgs/${o.id}`} className="hover:underline">
                  {o.legal_name}
                </Link>
              </td>
              <td>{o.country}</td>
              <td>{o.sme_classification}</td>
              <td>{o.employee_count ?? "—"}</td>
              <td>{o.created_at.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
          {orgs.length === 0 && (
            <tr>
              <td className="py-4 text-muted-foreground" colSpan={5}>
                No organizations yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
