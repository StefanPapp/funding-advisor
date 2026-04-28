import Link from "next/link";
import { listPrograms } from "@/server/programs";

const KINDS = ["grant", "equity", "debt", "alternative"] as const;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; country?: string }>;
}) {
  const sp = await searchParams;
  const kind = (KINDS as readonly string[]).includes(sp.kind ?? "") ? (sp.kind as typeof KINDS[number]) : undefined;
  const country = sp.country?.length === 2 ? sp.country.toUpperCase() : undefined;
  const rows = await listPrograms({ kind, country });

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Funding catalog</h1>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-muted-foreground">Kind:</span>
        <FilterLink href={`?${qs({ ...sp, kind: undefined })}`} active={!kind}>All</FilterLink>
        {KINDS.map((k) => (
          <FilterLink key={k} href={`?${qs({ ...sp, kind: k })}`} active={kind === k}>
            {k}
          </FilterLink>
        ))}
        <span className="ml-4 text-muted-foreground">Country:</span>
        {["AT", "DE", "EU"].map((c) => (
          <FilterLink
            key={c}
            href={`?${qs({ ...sp, country: c === "EU" ? undefined : c })}`}
            active={c === "EU" ? !country : country === c}
          >
            {c}
          </FilterLink>
        ))}
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Program</th>
            <th>Kind</th>
            <th>Provider</th>
            <th>Geography</th>
            <th>Range</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const scope = p.geography_scope as { scope: string; countries?: string[] };
            return (
              <tr key={p.id} className="border-b hover:bg-muted/40">
                <td className="py-2">
                  <Link href={`/catalog/${p.id}`} className="hover:underline">
                    {p.program_name}
                  </Link>
                </td>
                <td>{p.kind}</td>
                <td>{p.provider}</td>
                <td>{scope.scope === "EU" ? "EU" : (scope.countries ?? []).join(", ")}</td>
                <td>
                  {p.min_amount && p.max_amount
                    ? `€${formatM(p.min_amount)}–${formatM(p.max_amount)}`
                    : "—"}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td className="py-4 text-muted-foreground" colSpan={5}>
                No programs match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-2 py-0.5 rounded border ${active ? "bg-foreground text-background" : "hover:bg-muted"}`}
    >
      {children}
    </Link>
  );
}

function formatM(amount: string): string {
  const n = Number(amount);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return n.toString();
}

function qs(obj: Record<string, string | undefined>): string {
  return new URLSearchParams(
    Object.entries(obj).filter(([, v]) => v != null) as [string, string][]
  ).toString();
}
