import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "file:./local.db";
// better-sqlite3 expects a file path; strip "file:" if present
const filePath = connectionString.replace(/^file:/, "");

const sqlite = new Database(filePath);
export const db = drizzle(sqlite, { schema });

export * from "./schema";
