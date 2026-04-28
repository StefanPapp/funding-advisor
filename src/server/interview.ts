"use server";

import { db } from "@/db/client";
import { interview_sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { LanguageModel } from "ai";
import {
  orgScript,
  projectScript,
  nextQuestion,
  answeredQuestionIds,
  type Message,
  type Question,
} from "@/interview/scripts";
import { converseTurn } from "@/ai/converse";
import { extractFields } from "@/ai/extract";
import { selectModel } from "@/ai/models";

type SubjectType = "org" | "project";

type SessionState = {
  session: typeof interview_sessions.$inferSelect;
  next_question: Question | null;
};

function scriptFor(t: SubjectType) {
  return t === "org" ? orgScript : projectScript;
}

export async function startSession(
  subject_type: SubjectType,
  subject_id: string,
): Promise<SessionState> {
  const existing = await db
    .select()
    .from(interview_sessions)
    .where(eq(interview_sessions.subject_id, subject_id))
    .limit(1);

  if (existing.length > 0 && existing[0].subject_type === subject_type) {
    const next = nextQuestion(
      scriptFor(subject_type),
      answeredQuestionIds(existing[0].messages as Message[]),
    );
    return { session: existing[0], next_question: next };
  }

  const [created] = await db
    .insert(interview_sessions)
    .values({
      subject_type,
      subject_id,
      messages: [] as never,
      extracted_fields: {} as never,
    })
    .returning();

  const next = nextQuestion(scriptFor(subject_type), []);
  return { session: created, next_question: next };
}

export async function sendTurn(
  sessionId: string,
  userText: string,
  models?: { conversational?: LanguageModel },
): Promise<SessionState> {
  const [s] = await db
    .select()
    .from(interview_sessions)
    .where(eq(interview_sessions.id, sessionId));
  if (!s) throw new Error(`Session not found: ${sessionId}`);

  const messages = (s.messages as Message[]).slice();
  const answered = answeredQuestionIds(messages);
  const current = nextQuestion(scriptFor(s.subject_type), answered);
  if (!current) {
    return { session: s, next_question: null };
  }

  messages.push({
    role: "user",
    content: userText,
    timestamp: new Date().toISOString(),
  });

  const resolved = models?.conversational ?? selectModel("scoring");
  const model = "model" in resolved ? resolved.model : resolved;

  const reply = await converseTurn({ model, question: current, transcript: messages });

  messages.push({
    role: "assistant",
    content: reply.text,
    timestamp: new Date().toISOString(),
    ...(reply.kind === "followup"
      ? { followup_for: current.id }
      : { acknowledge_for: current.id }),
  });

  const [updated] = await db
    .update(interview_sessions)
    .set({ messages: messages as never, updated_at: new Date() })
    .where(eq(interview_sessions.id, sessionId))
    .returning();

  try {
    revalidatePath(`/orgs/${s.subject_id}/interview`);
    revalidatePath(`/projects/${s.subject_id}/interview`);
  } catch {}

  const next = nextQuestion(
    scriptFor(updated.subject_type),
    answeredQuestionIds(updated.messages as Message[]),
  );
  return { session: updated, next_question: next };
}

export async function applyExtraction(
  sessionId: string,
  models?: { extraction?: LanguageModel },
): Promise<{ proposed: Record<string, unknown> }> {
  const [s] = await db
    .select()
    .from(interview_sessions)
    .where(eq(interview_sessions.id, sessionId));
  if (!s) throw new Error(`Session not found: ${sessionId}`);

  const resolved = models?.extraction ?? selectModel("scoring");
  const model = "model" in resolved ? resolved.model : resolved;

  const r = await extractFields({
    model,
    subject_type: s.subject_type,
    transcript: s.messages as Message[],
  });

  await db
    .update(interview_sessions)
    .set({ extracted_fields: r.fields as never, updated_at: new Date() })
    .where(eq(interview_sessions.id, sessionId));

  try {
    revalidatePath(`/orgs/${s.subject_id}/interview`);
    revalidatePath(`/projects/${s.subject_id}/interview`);
  } catch {}

  return { proposed: r.fields };
}

export async function getSession(subject_type: SubjectType, subject_id: string) {
  const [s] = await db
    .select()
    .from(interview_sessions)
    .where(eq(interview_sessions.subject_id, subject_id))
    .limit(1);
  if (!s || s.subject_type !== subject_type) return null;
  const next = nextQuestion(
    scriptFor(subject_type),
    answeredQuestionIds(s.messages as Message[]),
  );
  return { session: s, next_question: next };
}
