import { notFound } from "next/navigation";
import { getProject } from "@/server/projects";
import { startSession } from "@/server/interview";
import { Chat } from "@/components/interview/Chat";
import type { Message } from "@/interview/scripts";

export default async function ProjectInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const state = await startSession("project", id);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Deep-dive interview — {project.title}</h1>
      <Chat
        sessionId={state.session.id}
        initialMessages={state.session.messages as Message[]}
        initialQuestion={state.next_question}
        initialExtracted={state.session.extracted_fields as Record<string, unknown>}
        subjectType="project"
        subjectId={id}
      />
    </section>
  );
}
