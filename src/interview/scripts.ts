export type Message = {
  role: "user" | "assistant";
  content: string;
  question_id?: string;
  acknowledge_for?: string;
  followup_for?: string;
  timestamp?: string;
};

export type Question = {
  id: string;
  text: string;
  target_field: string;
  required: boolean;
  hint?: string;
};

export type Section = {
  id: string;
  title: string;
  questions: Question[];
};

export const orgScript: Section[] = [
  {
    id: "legal_basics",
    title: "Legal basics",
    questions: [
      { id: "legal_form", text: "What's the legal form? (GmbH, AG, sole trader, …)", target_field: "legal_form", required: true },
      { id: "founded_on", text: "When was the company founded?", target_field: "founded_on", required: true },
      { id: "country", text: "What country is the headquarters in? (ISO-2 code)", target_field: "country", required: true },
    ],
  },
  {
    id: "size",
    title: "Size and financials",
    questions: [
      { id: "employee_count", text: "How many full-time employees do you have?", target_field: "employee_count", required: true },
      { id: "annual_revenue", text: "What was last year's annual revenue (EUR)?", target_field: "annual_revenue", required: true },
      { id: "balance_sheet_total", text: "What's your balance sheet total (EUR)?", target_field: "balance_sheet_total", required: false },
    ],
  },
  {
    id: "context",
    title: "Strategic context",
    questions: [
      {
        id: "narrative",
        text: "In a few sentences — what does the company do and where do you want it to be in 18 months?",
        target_field: "narrative",
        required: true,
      },
    ],
  },
];

export const projectScript: Section[] = [
  {
    id: "scope",
    title: "Scope",
    questions: [
      { id: "summary", text: "Summarize the project in 1-2 sentences.", target_field: "summary", required: true },
      { id: "trl", text: "What's the Technology Readiness Level (1-9)?", target_field: "trl", required: true },
      { id: "domain", text: "Which domains does this project sit in? (climate, deeptech, AI, etc.)", target_field: "domain", required: false },
    ],
  },
  {
    id: "funding",
    title: "Funding",
    questions: [
      { id: "total_budget", text: "What's the total project budget (EUR)?", target_field: "total_budget", required: true },
      { id: "funding_gap", text: "How much external funding do you need (EUR)?", target_field: "funding_gap", required: true },
      { id: "equity_willingness", text: "Are you open to giving up equity? (none / minority / majority)", target_field: "equity_willingness", required: true },
    ],
  },
  {
    id: "timeline",
    title: "Timeline",
    questions: [
      { id: "timeline_start", text: "When do you plan to start?", target_field: "timeline_start", required: false },
      { id: "duration_months", text: "Expected duration in months?", target_field: "duration_months", required: false },
    ],
  },
  {
    id: "context",
    title: "Strategic context",
    questions: [
      {
        id: "narrative",
        text: "What problem does this project solve? Who benefits, and how is it different from existing solutions?",
        target_field: "narrative",
        required: true,
      },
    ],
  },
];

export function answeredQuestionIds(messages: Message[]): string[] {
  return messages
    .filter((m) => m.role === "assistant" && m.acknowledge_for)
    .map((m) => m.acknowledge_for!)
    .filter((id, i, arr) => arr.indexOf(id) === i);
}

export function nextQuestion(script: Section[], answered: string[]): Question | null {
  for (const section of script) {
    for (const q of section.questions) {
      if (q.required && !answered.includes(q.id)) return q;
    }
  }
  return null;
}
