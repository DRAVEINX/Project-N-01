/**
 * Structural and resource validation for a full encrypted vault restore.
 * This runs on decrypted data before the vault adapter writes the new envelope.
 */
export function validateFullVaultData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.routines) || value.routines.length > 50) return false;
  let serialized;
  try { serialized = JSON.stringify(value); } catch { return false; }
  if (typeof serialized !== "string" || new TextEncoder().encode(serialized).byteLength > 1_000_000) return false;

  const limits = { routines:50, journalEntries:100, savedDrawings:8, agendaItems:100, moodEntries:365, trustedPeople:50 };
  for (const [key, limit] of Object.entries(limits)) {
    if (value[key] !== undefined && (!Array.isArray(value[key]) || value[key].length > limit)) return false;
  }
  const text = (item, max, required = false) => typeof item === "string" && item.length <= max && (!required || Boolean(item.trim()));
  const optionalText = (item, max) => item === undefined || (typeof item === "string" && item.length <= max);
  const date = item => {
    if (typeof item !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item)) return false;
    const [year, month, day] = item.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  };
  if ((value.routines || []).some(item =>
    !item || typeof item !== "object" || !text(item.id, 120, true) || !text(item.name, 60, true) ||
    !Array.isArray(item.steps) || item.steps.length < 1 || item.steps.length > 10 ||
    item.steps.some(step => !text(step, 120, true))
  )) return false;
  if ((value.journalEntries || []).some(item =>
    !item || typeof item !== "object" || !text(item.text, 5000, true) || !text(item.id, 120, true)
  )) return false;
  if ((value.savedDrawings || []).some(item =>
    !item || typeof item !== "object" || !text(item.id, 120, true) ||
    typeof item.dataUrl !== "string" || item.dataUrl.length > 200000 ||
    !item.dataUrl.startsWith("data:image/png;base64,")
  )) return false;
  if ((value.agendaItems || []).some(item =>
    !item || typeof item !== "object" || !text(item.id, 120, true) ||
    !text(item.title, 80, true) || !date(item.date) ||
    (item.time !== "" && item.time !== undefined && (typeof item.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))) ||
    !optionalText(item.details, 600)
  )) return false;
  if ((value.moodEntries || []).some(item =>
    !item || typeof item !== "object" || !text(item.id, 120, true) ||
    !date(item.date) || !Number.isInteger(item.mood) || item.mood < 1 || item.mood > 5 ||
    !optionalText(item.note, 300)
  )) return false;
  if ((value.trustedPeople || []).some(item =>
    !item || typeof item !== "object" || !text(item.id, 120, true) ||
    !text(item.name, 80, true) || !text(item.role, 80, true) ||
    !optionalText(item.contact, 120) || !optionalText(item.details, 500) ||
    !optionalText(item.photo, 180000) ||
    (item.photo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(item.photo))
  )) return false;
  return true;
}
