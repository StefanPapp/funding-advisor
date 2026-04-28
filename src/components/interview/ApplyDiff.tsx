"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  subjectType: "org" | "project";
  subjectId: string;
  proposed: Record<string, unknown>;
  onApplied: () => void;
};

export function ApplyDiff({ subjectType, subjectId, proposed }: Props) {
  const entries = Object.entries(proposed);
  const editHref = subjectType === "org" ? `/orgs/${subjectId}` : `/projects/${subjectId}`;

  return (
    <aside className="space-y-3">
      <h2 className="font-semibold">Proposed updates</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Click <em>Run extraction</em> to derive structured field values from the conversation so far.
        </p>
      ) : (
        <>
          <ul className="space-y-2 text-sm">
            {entries.map(([k, v]) => (
              <li key={k} className="border rounded p-2">
                <div className="font-medium">{k}</div>
                <div className="text-muted-foreground break-words">{String(v)}</div>
              </li>
            ))}
          </ul>
          <Button asChild>
            <Link href={editHref}>Open form to apply</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Plan D MVP: copy the proposed values into the master-data form and save. Per-field auto-apply is a follow-up.
          </p>
        </>
      )}
    </aside>
  );
}
