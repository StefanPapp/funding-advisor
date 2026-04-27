"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import {
  projectInsertSchema,
  projectStatusEnum,
  equityWillingnessEnum,
  type ProjectInsert,
} from "@/domain/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ProjectFormInput = z.input<typeof projectInsertSchema>;

type Org = { id: string; legal_name: string };

type Props = {
  orgs: Org[];
  initial?: Partial<ProjectInsert>;
  action: (data: ProjectInsert) => Promise<{ id: string } | void>;
  submitLabel?: string;
};

export function ProjectForm({ orgs, initial, action, submitLabel = "Save" }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormInput, unknown, ProjectInsert>({
    resolver: zodResolver(projectInsertSchema),
    defaultValues: {
      organization_id: initial?.organization_id ?? orgs[0]?.id,
      title: initial?.title ?? "",
      status: initial?.status ?? "idea",
      currency: initial?.currency ?? "EUR",
      domain: initial?.domain ?? [],
      consortium_partners: initial?.consortium_partners ?? [],
      ...initial,
    } as ProjectFormInput,
  });

  const onSubmit = (data: ProjectInsert) =>
    start(async () => {
      const r = await action(data);
      const id = r && "id" in r ? r.id : null;
      router.push(id ? `/projects/${id}` : "/projects");
      router.refresh();
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
      <Field label="Organization" error={errors.organization_id?.message}>
        {(id) => (
          <select
            id={id}
            className="border rounded px-2 py-1 w-full"
            {...register("organization_id")}
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.legal_name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Title" error={errors.title?.message}>
        {(id) => <Input id={id} {...register("title")} />}
      </Field>
      <Field label="Summary" error={errors.summary?.message}>
        {(id) => <Textarea id={id} {...register("summary")} rows={3} />}
      </Field>
      <Field label="Status" error={errors.status?.message}>
        {(id) => (
          <select id={id} className="border rounded px-2 py-1 w-full" {...register("status")}>
            {projectStatusEnum.options.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="TRL (1–9)" error={errors.trl?.message}>
        {(id) => (
          <Input
            id={id}
            type="number"
            min={1}
            max={9}
            {...register("trl", {
              setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
            })}
          />
        )}
      </Field>
      <Field label="Domains (comma-separated)" error={errors.domain?.message}>
        {(id) => (
          <Input
            id={id}
            {...register("domain", {
              setValueAs: (v) =>
                typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v,
            })}
          />
        )}
      </Field>
      <Field label="Total budget (EUR)" error={errors.total_budget?.message}>
        {(id) => <Input id={id} {...register("total_budget")} placeholder="0.00" />}
      </Field>
      <Field label="Funding gap (EUR)" error={errors.funding_gap?.message}>
        {(id) => <Input id={id} {...register("funding_gap")} placeholder="0.00" />}
      </Field>
      <Field label="Currency (ISO-3)" error={errors.currency?.message}>
        {(id) => <Input id={id} {...register("currency")} maxLength={3} />}
      </Field>
      <Field label="Timeline start" error={errors.timeline_start?.message}>
        {(id) => <Input id={id} type="date" {...register("timeline_start")} />}
      </Field>
      <Field label="Timeline end" error={errors.timeline_end?.message}>
        {(id) => <Input id={id} type="date" {...register("timeline_end")} />}
      </Field>
      <Field label="Duration (months)" error={errors.duration_months?.message}>
        {(id) => (
          <Input
            id={id}
            type="number"
            min={1}
            {...register("duration_months", {
              setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
            })}
          />
        )}
      </Field>
      <Field label="Equity willingness" error={errors.equity_willingness?.message}>
        {(id) => (
          <select
            id={id}
            className="border rounded px-2 py-1 w-full"
            {...register("equity_willingness")}
          >
            <option value="">—</option>
            {equityWillingnessEnum.options.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Narrative" error={errors.narrative?.message}>
        {(id) => <Textarea id={id} {...register("narrative")} rows={4} />}
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
