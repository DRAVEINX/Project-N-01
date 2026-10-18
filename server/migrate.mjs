import { readFile } from "node:fs/promises";
import pg from "pg";
const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: true } });
try {
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await pool.query(schema);
  process.stdout.write("Project N-01 database schema is up to date.\n");
} finally { await pool.end(); }
