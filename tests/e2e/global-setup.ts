import { resetDb, closeDb, testDb } from "../db";
import { funding_programs } from "@/db/schema";
import { sql } from "drizzle-orm";
import { seedPrograms } from "@/db/seeds/programs";

export default async function globalSetup() {
  await resetDb();
  await testDb.execute(sql`TRUNCATE TABLE funding_programs RESTART IDENTITY CASCADE`);
  for (const p of seedPrograms) {
    await testDb.insert(funding_programs).values({
      ...p,
      application_deadline: undefined,
      last_verified_at: new Date(),
    });
  }
  await closeDb();
}
