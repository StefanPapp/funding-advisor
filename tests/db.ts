import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { sql } from "drizzle-orm";

const url = process.env.DATABASE_URL ?? "postgres://dev:dev@localhost:5432/funding_advisor";
const queryClient = postgres(url, { max: 5 });
export const testDb = drizzle(queryClient, { schema });

export async function resetDb() {
  await testDb.execute(sql`TRUNCATE TABLE projects, organizations RESTART IDENTITY CASCADE`);
}

export async function closeDb() {
  await queryClient.end();
}
