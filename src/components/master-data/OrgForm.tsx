"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import { orgInsertSchema, type OrgInsert } from "@/domain/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type OrgFormInput = z.input<typeof orgInsertSchema>;

type Props = {
  initial?: Partial<OrgInsert>;
  action: (data: OrgInsert) => Promise<{ id: string } | void>;
  submitLabel?: string;
};

export function OrgForm({ initial, action, submitLabel = "Save" }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrgFormInput, unknown, OrgInsert>({
    resolver: zodResolver(orgInsertSchema),
    defaultValues: {
      legal_name: initial?.legal_name ?? "",
      country: initial?.country ?? "AT",
      sectors: initial?.sectors ?? [],
      ...initial,
    } as OrgFormInput,
  });

  const onSubmit = (data: OrgInsert) =>
    start(async () => {
      const r = await action(data);
      const id = r && "id" in r ? r.id : null;
      router.push(id ? `/orgs/${id}` : "/orgs");
      router.refresh();
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
      <Field label="Legal name" error={errors.legal_name?.message}>
        <Input {...register("legal_name")} />
      </Field>
      <Field label="Trading name" error={errors.trading_name?.message}>
        <Input {...register("trading_name")} />
      </Field>
      <Field label="Country (ISO-2)" error={errors.country?.message}>
        <Input {...register("country")} maxLength={2} />
      </Field>
      <Field label="Region (NUTS-2)" error={errors.region?.message}>
        <Input {...register("region")} />
      </Field>
      <Field label="Legal form" error={errors.legal_form?.message}>
        <Input {...register("legal_form")} placeholder="GmbH, AG, …" />
      </Field>
      <Field label="Employees" error={errors.employee_count?.message}>
        <Input
          type="number"
          min={0}
          {...register("employee_count", {
            setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
          })}
        />
      </Field>
      <Field label="Annual revenue (EUR)" error={errors.annual_revenue?.message}>
        <Input {...register("annual_revenue")} placeholder="0.00" />
      </Field>
      <Field label="Balance sheet total (EUR)" error={errors.balance_sheet_total?.message}>
        <Input {...register("balance_sheet_total")} placeholder="0.00" />
      </Field>
      <Field label="Sectors (comma-separated NACE codes)" error={errors.sectors?.message}>
        <Input
          {...register("sectors", {
            setValueAs: (v) =>
              typeof v === "string"
                ? v.split(",").map((s) => s.trim()).filter(Boolean)
                : v,
          })}
        />
      </Field>
      <Field label="Narrative" error={errors.narrative?.message}>
        <Textarea {...register("narrative")} rows={4} />
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
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
