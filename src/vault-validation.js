/**
 * Validation for decrypted full-vault backups.
 * Validation runs before EncryptedVault writes an imported envelope, so invalid
 * data is rejected before the current stored vault is replaced.
 */
const MAX_VAULT_BYTES = 900_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHOTO_RE = /^data:image\/(png|jpeg|webp);base64,/;
const DRAWING_RE = /^data:image\/png;base64,/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value, maxLength) {
  return value === undefined || (typeof value === "string" && value.length <= maxLength);
}

function validRoutine(item) {
  return isObject(item) &&
    typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 60 &&
    Array.isArray(item.steps) && item.steps.length >= 1 && item.steps.length <= 10 &&
    item.steps.every(step => typeof step === "string" && step.trim().length > 0 && step.length <= 120);
}

function validJournalEntry(item) {
  return isObject(item) &&
    typeof item.id === "string" && item.id.length > 0 && item.id.length <= 120 &&
    typeof item.text === "string" && item.text.trim().length > 0 && item.text.length <= 5000 &&
    typeof item.createdAt === "string" && item.createdAt.length <= 60;
}

function validDrawing(item) {
  return isObject(item) &&
    typeof item.id === "string" && item.id.length > 0 && item.id.length <= 120 &&
    typeof item.dataUrl === "string" && DRAWING_RE.test(item.dataUrl) && item.dataUrl.length <= 200_000 &&
    typeof item.createdAt === "string" && item.createdAt.length <= 60;
}

function validAppointment(item) {
  return isObject(item) &&
    typeof item.id === "string" && item.id.length > 0 && item.id.length <= 120 &&
    typeof item.title === "string" && item.title.trim().length > 0 && item.title.length <= 80 &&
    typeof item.date === "string" && DATE_RE.test(item.date) &&
    optionalString(item.time, 5) &&
    optionalString(item.details, 600) &&
    (item.done === undefined || typeof item.done === "boolean") &&
    typeof item.createdAt === "string" && item.createdAt.length <= 60;
}

function validMoodEntry(item) {
  return isObject(item) &&
    typeof item.id === "string" && item.id.length > 0 && item.id.length <= 120 &&
    typeof item.date === "string" && DATE_RE.test(item.date) &&
    Number.isInteger(item.mood) && item.mood >= 1 && item.mood <= 5 &&
    optionalString(item.note, 300) &&
    typeof item.updatedAt === "string" && item.updatedAt.length <= 60;
}

function validTrustedPerson(item) {
  const photoValid = item && (item.photo === undefined || item.photo === "" ||
    (typeof item.photo === "string" && PHOTO_RE.test(item.photo) && item.photo.length <= 180_000));
  return isObject(item) &&
    typeof item.id === "string" && item.id.length > 0 && item.id.length <= 120 &&
    typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 80 &&
    typeof item.role === "string" && item.role.trim().length > 0 && item.role.length <= 80 &&
    optionalString(item.contact, 120) &&
    optionalString(item.details, 500) &&
    photoValid &&
    typeof item.createdAt === "string" && item.createdAt.length <= 60;
}

/**
 * Accepts the prototype's current/legacy vault shape while bounding all known
 * personal-data collections. Returns true only for safe, supported JSON data.
 */
export function validateRestoredVaultData(data) {
  try {
    if (!isObject(data) || !Array.isArray(data.routines) || data.routines.length > 50) return false;
    if (!data.routines.every(validRoutine)) return false;

    const limits = [
      ["journalEntries", 100, validJournalEntry],
      ["savedDrawings", 8, validDrawing],
      ["agendaItems", 100, validAppointment],
      ["moodEntries", 365, validMoodEntry],
      ["trustedPeople", 50, validTrustedPerson]
    ];
    for (const [key, limit, validator] of limits) {
      if (data[key] === undefined) continue;
      if (!Array.isArray(data[key]) || data[key].length > limit || !data[key].every(validator)) return false;
    }

    const serialized = JSON.stringify(data);
    if (typeof serialized !== "string") return false;
    return new TextEncoder().encode(serialized).byteLength <= MAX_VAULT_BYTES;
  } catch {
    return false;
  }
}
