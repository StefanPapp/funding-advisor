import { notFound } from "next/navigation";
import { getOrg } from "@/server/orgs";
import { startSession } from "@/server/interview";
import { Chat } from "@/components/interview/Chat";
import type { Message } from "@/interview/scripts";

export default async function OrgInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getOrg(id);
  if (!org) notFound();
  const state = await startSession("org", id);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Deep-dive interview — {org.legal_name}</h1>
      <Chat
        sessionId={state.session.id}
        initialMessages={state.session.messages as Message[]}
        initialQuestion={state.next_question}
        initialExtracted={state.session.extracted_fields as Record<string, unknown>}
        subjectType="org"
        subjectId={id}
      />
    </section>
  );
}
