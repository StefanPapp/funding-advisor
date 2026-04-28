"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { runStrategy } from "@/server/strategy.action";

export function StrategyRun({ projectId, hasReport }: { projectId: string; hasReport: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () =>
    start(async () => {
      setError(null);
      try {
        await runStrategy(projectId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });

  return (
    <div className="space-y-2">
      <Button onClick={onClick} disabled={pending}>
        {pending ? "Generating…" : hasReport ? "Regenerate strategy" : "Generate strategy"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
