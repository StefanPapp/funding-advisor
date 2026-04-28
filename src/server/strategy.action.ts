"use server";

import { generateStrategy } from "./strategy";
import { revalidatePath } from "next/cache";

export async function runStrategy(projectId: string) {
  const result = await generateStrategy({ projectId });
  try {
    revalidatePath(`/projects/${projectId}/strategy`);
  } catch {}
  return result;
}
