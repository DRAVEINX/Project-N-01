import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "../src/server/argon2-passwords.js";
import { bootstrapNovaLifeDeveloperAdmin } from "../src/server/initial-admin-bootstrap.js";

function adminDatabaseUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("invalid admin database URL"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname ||
      !url.username || !url.password) throw new Error("invalid admin database URL");
  for (const key of [...url.searchParams.keys()]) {
    if (/^ssl(mode|cert|key|rootcert|password)?$/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

function readHiddenPassword(prompt) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new Error("password input requires an interactive terminal"));
      return;
    }
    let value = "";
    let finished = false;
    const previousEncoding = stdin.readableEncoding;
    const cleanup = (error = null) => {
      if (finished) return;
      finished = true;
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.setEncoding(previousEncoding || "utf8");
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of String(chunk)) {
        if (character === "\u0003") return cleanup(new Error("cancelled"));
        if (character === "\r" || character === "\n") return cleanup();
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " " && character !== "\u007f") value += character;
      }
    };
    stdout.write(prompt);
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function main() {
  if (process.env.NOVALIFE_BOOTSTRAP_CONFIRM !== "CREATE_FIRST_DEVELOPER_ADMIN") {
    throw new Error("set NOVALIFE_BOOTSTRAP_CONFIRM=CREATE_FIRST_DEVELOPER_ADMIN only when intentionally creating the first administrator");
  }
  const rawAdminUrl = process.env.NOVALIFE_ADMIN_DATABASE_URL;
  if (!rawAdminUrl) throw new Error("set NOVALIFE_ADMIN_DATABASE_URL in a secure local environment");

  const rl = createInterface({ input: stdin, output: stdout });
  let id;
  let email;
  try {
    const suggestedId = randomUUID();
    id = (await rl.question(`Initial developer-admin ID [${suggestedId}]: `)).trim() || suggestedId;
    email = (await rl.question("Initial developer-admin email: ")).trim();
    const typed = (await rl.question("Type CREATE FIRST ADMIN to continue: ")).trim();
    if (typed !== "CREATE FIRST ADMIN") throw new Error("bootstrap confirmation did not match");
  } finally {
    rl.close();
  }

  const password = await readHiddenPassword("Initial administrator password (input hidden): ");
  const confirmation = await readHiddenPassword("Repeat password (input hidden): ");
  if (!password || password !== confirmation) throw new Error("passwords are empty or do not match");

  const pool = new Pool({
    connectionString: adminDatabaseUrl(rawAdminUrl),
    ssl: { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
    options: "-c statement_timeout=10000 -c idle_in_transaction_session_timeout=15000",
    application_name: "novalife-one-time-initial-admin-bootstrap",
  });
  try {
    const result = await pool.query(`
      SELECT current_user,
             has_table_privilege(current_user, 'public.novalife_accounts', 'INSERT') AS can_insert_accounts,
             has_table_privilege(current_user, 'public.novalife_accounts', 'SELECT') AS can_read_accounts,
             has_table_privilege(current_user, 'public.novalife_audit_events', 'INSERT') AS can_insert_audit
    `);
    const role = result.rows[0];
    if (!role ||
        ["anon", "authenticated", "service_role", "novalife_api"].includes(role.current_user) ||
        role.can_insert_accounts !== true ||
        role.can_read_accounts !== true ||
        role.can_insert_audit !== true) {
      throw new Error("database connection is not a trusted bootstrap administrator");
    }
    const created = await bootstrapNovaLifeDeveloperAdmin({
      pool, id, email, password, hashPassword,
    });
    stdout.write(
      "Initial developer-admin created and audit recorded. Keep this account secure.\n" +
      "Account ID: " + created.id + "\n"
    );
  } finally {
    await pool.end().catch(() => {});
  }
}

try {
  await main();
} catch (error) {
  console.error(
    error?.message?.startsWith("set ") ||
    error?.message === "invalid admin database URL" ||
    error?.message === "bootstrap confirmation did not match" ||
    error?.message === "password input requires an interactive terminal" ||
    error?.message === "passwords are empty or do not match" ||
    error?.message === "cancelled" ||
    error?.message === "database connection is not a trusted bootstrap administrator" ||
    error?.message === "bootstrap-already-completed"
      ? error.message
      : "Initial administrator bootstrap failed. Sensitive database details were not logged."
  );
  process.exitCode = 1;
}
