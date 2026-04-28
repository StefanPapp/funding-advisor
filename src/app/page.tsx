import { listOrgs } from "@/server/orgs";
import { listProjects } from "@/server/projects";

// Counts are read on every request — otherwise they freeze to deploy-time state.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [orgs, projects] = await Promise.all([listOrgs(), listProjects()]);
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Organizations" value={orgs.length} />
        <Stat label="Projects" value={projects.length} />
        <Stat label="Active funding pursuits" value={projects.filter((p) => p.status === "seeking_funding").length} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}
