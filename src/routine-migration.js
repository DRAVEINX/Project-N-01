/**
 * Non-destructive migration helpers for the legacy custom-routines record.
 *
 * These helpers deliberately do not remove or modify the plaintext source.
 * UI integration must show the user what will be copied and provide a separate,
 * explicit cleanup step only after the encrypted copy has been verified.
 */
const LEGACY_ROUTINES_KEY = "project-n-01-custom-routines-v1";

export function readLegacyRoutines(storage, key = LEGACY_ROUTINES_KEY) {
  if (!storage || typeof storage.getItem !== "function") {
    throw new TypeError("A Storage-compatible object is required.");
  }
  const raw = storage.getItem(key);
  if (raw === null) return { found: false, routines: [], warnings: [] };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { found: true, routines: [], warnings: ["invalid-json"] };
  }
  if (!Array.isArray(parsed)) {
    return { found: true, routines: [], warnings: ["not-an-array"] };
  }

  const warnings = [];
  const routines = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object" || typeof item.name !== "string" || !Array.isArray(item.steps)) {
      warnings.push("invalid-routine-skipped");
      continue;
    }
    const name = item.name.trim().slice(0, 60);
    const steps = item.steps
      .filter(step => typeof step === "string")
      .map(step => step.trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 10);
    if (!name || steps.length === 0) {
      warnings.push("empty-routine-skipped");
      continue;
    }
    routines.push({
      id: typeof item.id === "string" && item.id.length <= 100 ? item.id : `migrated-${routines.length + 1}`,
      name,
      steps
    });
    if (routines.length >= 50) {
      warnings.push("routine-limit-reached");
      break;
    }
  }
  return { found: true, routines, warnings };
}

/**
 * Copies valid legacy routines to a new encrypted vault without deleting the
 * original plaintext record. The caller must explicitly handle cleanup later.
 */
export async function migrateLegacyRoutines({ storage, vault, passphrase, legacyKey = LEGACY_ROUTINES_KEY }) {
  if (!vault || typeof vault.initialize !== "function" || typeof vault.read !== "function") {
    throw new TypeError("An encrypted vault is required.");
  }
  const preview = readLegacyRoutines(storage, legacyKey);
  if (!preview.found) throw new Error("No legacy routine record was found.");
  if (preview.warnings.includes("invalid-json") || preview.warnings.includes("not-an-array")) {
    throw new Error("Legacy routine data is invalid; original data was left untouched.");
  }
  const expected = { routines: preview.routines };
  try {
    await vault.initialize(passphrase, expected);
    const verified = vault.read();
    if (JSON.stringify(verified) !== JSON.stringify(expected)) {
      throw new Error("verification-mismatch");
    }
  } catch (error) {
    // An existing vault is a precondition failure, not a failed migration:
    // never lock or otherwise disturb the user's already-open vault.
    if (/vault already exists|vault was created by another session/i.test(error?.message || "")) throw error;
    // If initialization or read-back fails, do not leave a partially initialized
    // vault session open and never remove or modify the legacy plaintext source.
    try { vault.lock?.(); } catch { /* Preserve the original migration failure. */ }
    throw new Error("Encrypted migration verification failed; original data was left untouched.");
  }
  return {
    routineCount: preview.routines.length,
    warnings: preview.warnings,
    legacyDataPreserved: true
  };
}

export const legacyRoutineStorageKey = LEGACY_ROUTINES_KEY;
