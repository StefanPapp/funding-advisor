import { resetDb, closeDb } from "../db";

export default async function globalSetup() {
  await resetDb();
  await closeDb();
}
