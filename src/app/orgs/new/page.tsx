import { OrgForm } from "@/components/master-data/OrgForm";
import { createOrg } from "@/server/orgs";
import type { OrgInsert } from "@/domain/schemas";

export default function NewOrgPage() {
  async function action(data: OrgInsert) {
    "use server";
    const id = await createOrg(data);
    return { id };
  }
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">New organization</h1>
      <OrgForm action={action} submitLabel="Create" />
    </section>
  );
}
