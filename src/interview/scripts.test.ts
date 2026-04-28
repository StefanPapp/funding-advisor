import { describe, it, expect } from "vitest";
import { orgScript, projectScript, nextQuestion, answeredQuestionIds } from "./scripts";

describe("orgScript", () => {
  it("contains required questions for legal_form, country, employees, revenue", () => {
    const ids = orgScript.flatMap((s) => s.questions.map((q) => q.id));
    expect(ids).toContain("legal_form");
    expect(ids).toContain("employee_count");
    expect(ids).toContain("annual_revenue");
  });

  it("every required question has a target_field", () => {
    for (const section of orgScript) {
      for (const q of section.questions) {
        if (q.required) expect(q.target_field).toBeTruthy();
      }
    }
  });
});

describe("projectScript", () => {
  it("contains required questions for trl, funding_gap", () => {
    const ids = projectScript.flatMap((s) => s.questions.map((q) => q.id));
    expect(ids).toContain("trl");
    expect(ids).toContain("funding_gap");
  });
});

describe("nextQuestion", () => {
  it("returns the first required question when no answers exist", () => {
    const q = nextQuestion(orgScript, []);
    expect(q?.required).toBe(true);
  });

  it("skips already-answered questions", () => {
    const answered = [orgScript[0].questions[0].id];
    const q = nextQuestion(orgScript, answered);
    expect(q?.id).not.toBe(answered[0]);
  });

  it("returns null when all required answered", () => {
    const allRequired = orgScript.flatMap((s) =>
      s.questions.filter((q) => q.required).map((q) => q.id)
    );
    const q = nextQuestion(orgScript, allRequired);
    expect(q).toBeNull();
  });
});

describe("answeredQuestionIds", () => {
  it("extracts question ids from messages with question metadata", () => {
    const messages = [
      { role: "assistant" as const, content: "What is your legal form?", question_id: "legal_form" },
      { role: "user" as const, content: "GmbH" },
      { role: "assistant" as const, content: "Acknowledged.", acknowledge_for: "legal_form" },
    ];
    expect(answeredQuestionIds(messages)).toEqual(["legal_form"]);
  });
});
