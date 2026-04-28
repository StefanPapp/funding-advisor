import { notFound } from "next/navigation";
import { getProgram } from "@/server/programs";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getProgram(id);
  if (!p) notFound();

  const scope = p.geography_scope as { scope: string; countries?: string[]; regions?: string[] };
  const rules = p.eligibility_rules as Record<string, unknown>;

  return (
    <article className="space-y-6 max-w-3xl">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground uppercase tracking-wide">{p.kind}</p>
        <h1 className="text-2xl font-semibold">{p.program_name}</h1>
        <p className="text-muted-foreground">{p.provider}</p>
        {p.url && (
          <p className="text-sm">
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline">
              Official page ↗
            </a>
          </p>
        )}
      </header>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Item label="Geography">
          {scope.scope === "EU" ? "EU-wide" : `${scope.scope} — ${(scope.countries ?? []).join(", ")}`}
          {scope.regions && scope.regions.length > 0 ? ` (${scope.regions.join(", ")})` : ""}
        </Item>
        <Item label="Amount range">
          {p.min_amount && p.max_amount
            ? `€${Number(p.min_amount).toLocaleString()} – €${Number(p.max_amount).toLocaleString()}`
            : "—"}
        </Item>
        <Item label="Deadline">
          {p.application_deadline ? p.application_deadline : "Rolling"}
        </Item>
        <Item label="Confidence">{p.confidence}</Item>
      </dl>

      <section>
        <h2 className="text-lg font-semibold mb-2">Eligibility rules</h2>
        <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{JSON.stringify(rules, null, 2)}
        </pre>
      </section>

      {p.domains.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Domains</h2>
          <ul className="flex flex-wrap gap-2">
            {p.domains.map((d) => (
              <li key={d} className="px-2 py-0.5 border rounded text-sm">{d}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
