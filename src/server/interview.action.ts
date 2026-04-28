"use server";

import { sendTurn as svcSendTurn, applyExtraction as svcApplyExtraction } from "./interview";

export async function sendTurnAction(sessionId: string, userText: string) {
  return svcSendTurn(sessionId, userText);
}

export async function applyExtractionAction(sessionId: string) {
  return svcApplyExtraction(sessionId);
}
