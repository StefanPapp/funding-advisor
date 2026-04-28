"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendTurnAction, applyExtractionAction } from "@/server/interview.action";
import { useRouter } from "next/navigation";
import { ApplyDiff } from "./ApplyDiff";
import type { Message, Question } from "@/interview/scripts";

type Props = {
  sessionId: string;
  initialMessages: Message[];
  initialQuestion: Question | null;
  initialExtracted: Record<string, unknown>;
  subjectType: "org" | "project";
  subjectId: string;
};

export function Chat(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [messages, setMessages] = useState(props.initialMessages);
  const [currentQ, setCurrentQ] = useState(props.initialQuestion);
  const [text, setText] = useState("");
  const [extracted, setExtracted] = useState(props.initialExtracted);
  const [error, setError] = useState<string | null>(null);

  const onSend = () => {
    if (!text.trim() || pending) return;
    const value = text;
    setText("");
    start(async () => {
      setError(null);
      try {
        const r = await sendTurnAction(props.sessionId, value);
        setMessages(r.session.messages as Message[]);
        setCurrentQ(r.next_question);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  const onExtract = () => {
    start(async () => {
      setError(null);
      try {
        const r = await applyExtractionAction(props.sessionId);
        setExtracted(r.proposed);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="border rounded p-4 h-[400px] overflow-y-auto space-y-3 text-sm">
          {messages.length === 0 && (
            <p className="text-muted-foreground">No messages yet. The interview will start with the first scripted question below.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-foreground" : "text-blue-700 dark:text-blue-300"}>
              <span className="font-medium">{m.role === "user" ? "You" : "Interviewer"}:</span> {m.content}
            </div>
          ))}
        </div>

        {currentQ ? (
          <div className="text-sm text-muted-foreground">
            <strong>Current question:</strong> {currentQ.text}
          </div>
        ) : (
          <p className="text-sm text-green-700">All required questions answered.</p>
        )}

        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer…"
            rows={3}
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button onClick={onSend} disabled={pending || !text.trim()}>
              {pending ? "Sending…" : "Send"}
            </Button>
            <Button variant="outline" onClick={onExtract} disabled={pending || messages.length === 0}>
              Run extraction
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>

      <ApplyDiff
        subjectType={props.subjectType}
        subjectId={props.subjectId}
        proposed={extracted}
        onApplied={() => router.refresh()}
      />
    </div>
  );
}
