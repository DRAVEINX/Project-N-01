import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "../src/server/argon2-passwords.js";
import {
  provisionNovaLifeAccount,
  novaLifeProvisionableAccountRoles,
} from "../src/server/private-account-provisioner.js";

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
    stdout.write(prompt);

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
        if (character === "\u0003") {
          cleanup(new Error("cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else if (character >= " " && character !== "\u007f") {
          value += character;
        }
      }
    };

    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function main() {
  const operatorId = process.env.NOVALIFE_OPERATOR_ID?.trim();
  const rawAdminUrl = process.env.NOVALIFE_ADMIN_DATABASE_URL;
  if (!operatorId || !rawAdminUrl) {
    throw new Error("set NOVALIFE_OPERATOR_ID and NOVALIFE_ADMIN_DATABASE_URL in a secure local environment");
  }

  const rl = createInterface({ input: stdin, output: stdout });
  let id;
  let email;
  let role;
  try {
    const defaultId = randomUUID();
    id = (await rl.question(`Account ID [${defaultId}]: `)).trim() || defaultId;
    email = (await rl.question("Account email: ")).trim();
    stdout.write("Permitted roles: " + novaLifeProvisionableAccountRoles.join(", ") + "\n");
    role = (await rl.question("Account role: ")).trim();
  } finally {
    rl.close();
  }

  const password = await readHiddenPassword("New account password (input hidden): ");
  const confirmation = await readHiddenPassword("Repeat password (input hidden): ");
  if (!password || password !== confirmation) {
    throw new Error("passwords are empty or do not match");
  }

  const pool = new Pool({
    connectionString: adminDatabaseUrl(rawAdminUrl),
    ssl: { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
    options: "-c statement_timeout=10000 -c idle_in_transaction_session_timeout=15000",
    application_name: "novalife-private-account-provisioner",
  });

  try {
    const privileges = await pool.query(`
      SELECT current_user,
             has_table_privilege(current_user, 'public.novalife_accounts', 'INSERT') AS can_insert_accounts,
             has_table_privilege(current_user, 'public.novalife_audit_events', 'INSERT') AS can_insert_audit
    `);
    const roleCheck = privileges.rows[0];
    if (!roleCheck || ["anon", "authenticated", "service_role", "novalife_api"].includes(roleCheck.current_user) ||
        roleCheck.can_insert_accounts !== true || roleCheck.can_insert_audit !== true) {
      throw new Error("database connection is not a trusted account-provisioning connection");
    }

    await provisionNovaLifeAccount({
      pool,
      id,
      email,
      password,
      role,
      operatorId,
      hashPassword,
    });
    stdout.write("Account created and audited. No client assignment or consent was granted.\n");
  } finally {
    password.toString(); // Keep local scope explicit; never log or return the password.
    await pool.end().catch(() => {});
  }
}

try {
  await main();
} catch (error) {
  console.error(error?.message?.startsWith("set ") ||
      error?.message === "password input requires an interactive terminal" ||
      error?.message === "passwords are empty or do not match" ||
      error?.message === "cancelled" ||
      error?.message === "invalid admin database URL" ||
      error?.message === "database connection is not a trusted account-provisioning connection"
    ? error.message
    : "Account provisioning failed. No password, hash, SQL details or database credentials were logged.");
  process.exitCode = 1;
}
