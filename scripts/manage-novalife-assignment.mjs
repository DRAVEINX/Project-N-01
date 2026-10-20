import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Pool } from "pg";
import {
  createNovaLifeAssignment,
  deactivateNovaLifeAssignment,
  novaLifeAssignmentRoles,
} from "../src/server/private-assignment-provisioner.js";

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

async function main() {
  const operatorId = process.env.NOVALIFE_OPERATOR_ID?.trim();
  const rawAdminUrl = process.env.NOVALIFE_ADMIN_DATABASE_URL;
  if (!operatorId || !rawAdminUrl) {
    throw new Error("set NOVALIFE_OPERATOR_ID and NOVALIFE_ADMIN_DATABASE_URL in a secure local environment");
  }

  const rl = createInterface({ input: stdin, output: stdout });
  let operation, assignmentId, actorId, clientId, assignmentRole, validFrom, validUntil;
  try {
    operation = (await rl.question("Operation (create/deactivate): ")).trim().toLowerCase();
    if (operation === "create") {
      actorId = (await rl.question("Existing caregiver/parent/guardian account ID: ")).trim();
      clientId = (await rl.question("Existing client account ID: ")).trim();
      stdout.write("Allowed assignment roles: " + novaLifeAssignmentRoles.join(", ") + "\n");
      assignmentRole = (await rl.question("Assignment role: ")).trim();
      validFrom = (await rl.question("Starts at ISO date-time [now]: ")).trim();
      validUntil = (await rl.question("Ends at ISO date-time [no end date]: ")).trim();
    } else if (operation === "deactivate") {
      assignmentId = (await rl.question("Existing assignment ID: ")).trim();
    } else {
      throw new Error("operation must be create or deactivate");
    }
  } finally {
    rl.close();
  }

  const pool = new Pool({
    connectionString: adminDatabaseUrl(rawAdminUrl),
    ssl: { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
    options: "-c statement_timeout=10000 -c idle_in_transaction_session_timeout=15000",
    application_name: "novalife-private-assignment-manager",
  });

  try {
    const privilegeCheck = await pool.query(`
      SELECT current_user,
             has_table_privilege(current_user, 'public.novalife_accounts', 'SELECT') AS can_read_accounts,
             has_table_privilege(current_user, 'public.novalife_client_assignments', 'INSERT') AS can_create_assignments,
             has_table_privilege(current_user, 'public.novalife_client_assignments', 'UPDATE') AS can_update_assignments,
             has_table_privilege(current_user, 'public.novalife_audit_events', 'INSERT') AS can_insert_audit
    `);
    const p = privilegeCheck.rows[0];
    if (!p ||
        ["anon", "authenticated", "service_role", "novalife_api"].includes(p.current_user) ||
        p.can_read_accounts !== true ||
        (operation === "create" && p.can_create_assignments !== true) ||
        (operation === "deactivate" && p.can_update_assignments !== true) ||
        p.can_insert_audit !== true) {
      throw new Error("database connection is not a trusted assignment-administration connection");
    }

    if (operation === "create") {
      const result = await createNovaLifeAssignment({
        pool,
        actorId,
        clientId,
        assignmentRole,
        operatorId,
        validFrom: validFrom || undefined,
        validUntil: validUntil || null,
      });
      stdout.write(
        "Assignment created and audited. The client has not granted consent yet.\n" +
        "Assignment ID: " + result.id + "\n"
      );
    } else {
      const result = await deactivateNovaLifeAssignment({ pool, assignmentId, operatorId });
      stdout.write(result.deactivated
        ? "Assignment deactivated and audited. Current access checks will no longer accept this assignment.\n"
        : "No active assignment found. The attempt was audited.\n");
    }
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
    error?.message === "database connection is not a trusted assignment-administration connection" ||
    error?.message === "operation must be create or deactivate"
      ? error.message
      : "Assignment administration failed. Sensitive database details were not logged."
  );
  process.exitCode = 1;
}
