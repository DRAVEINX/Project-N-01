/**
 * Appointment collision checks. Times are local HH:mm strings and the default
 * safety window blocks another appointment within 30 minutes on the same date.
 */
export function normaliseAppointmentTitle(value) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function timeToMinutes(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function findDuplicateAppointment(candidate, appointments, excludeId = null, windowMinutes = 30) {
  if (!candidate || typeof candidate.date !== "string" || !Array.isArray(appointments)) return null;
  const candidateTime = timeToMinutes(candidate.time);
  const candidateTitle = normaliseAppointmentTitle(candidate.title);

  for (const existing of appointments) {
    if (!existing || typeof existing !== "object") continue;
    if (excludeId && existing.id === excludeId) continue;
    if (existing.done || existing.date !== candidate.date) continue;

    const existingTime = timeToMinutes(existing.time);
    if (candidateTime !== null && existingTime !== null) {
      if (Math.abs(candidateTime - existingTime) <= Math.max(0, windowMinutes)) return existing;
      continue;
    }
    // When either appointment has no time, only matching titles count as duplicates.
    if (candidateTitle && candidateTitle === normaliseAppointmentTitle(existing.title)) return existing;
  }
  return null;
}

/**
 * Prevent a worker being added twice on the same day. The same worker can be
 * scheduled on multiple dates and existing assignments can be edited in place.
 */
export function findDuplicateWorkAssignment(candidate, assignments, excludeId = null) {
  if (!candidate || typeof candidate.date !== "string" || typeof candidate.name !== "string" || !Array.isArray(assignments)) return null;
  const name = normaliseAppointmentTitle(candidate.name);
  if (!name) return null;
  return assignments.find(existing =>
    existing && typeof existing === "object" &&
    (!excludeId || existing.id !== excludeId) &&
    existing.date === candidate.date &&
    normaliseAppointmentTitle(existing.name) === name
  ) || null;
}

/**
 * Checks whether appointment blocks collide, including the appointment duration
 * and a 30-minute transition buffer. Timeless items use the legacy title check.
 */
export function findAppointmentConflict(candidate, appointments, excludeId = null, bufferMinutes = 30) {
  if (!candidate || typeof candidate.date !== "string" || !Array.isArray(appointments)) return null;
  const start = timeToMinutes(candidate.time);
  if (start === null) return null;
  const duration = Number.isInteger(Number(candidate.durationMinutes)) && Number(candidate.durationMinutes) > 0
    ? Math.min(480, Number(candidate.durationMinutes)) : 30;
  const candidateEnd = start + duration;
  const buffer = Math.max(0, Math.min(240, Number(bufferMinutes) || 0));

  for (const existing of appointments) {
    if (!existing || typeof existing !== "object" || existing.done) continue;
    if (excludeId && existing.id === excludeId) continue;
    if (existing.done || existing.date !== candidate.date) continue;
    const otherStart = timeToMinutes(existing.time);
    if (otherStart === null) continue;
    const otherDuration = Number.isInteger(Number(existing.durationMinutes)) && Number(existing.durationMinutes) > 0
      ? Math.min(480, Number(existing.durationMinutes)) : 30;
    const otherEnd = otherStart + otherDuration;
    // Requires the events to be separated by the configured buffer, including
    // cases where a long appointment overlaps a later start.
    if (start < otherEnd + buffer && otherStart < candidateEnd + buffer) return existing;
  }
  return null;
}

/** Build weekly dates with local calendar arithmetic, avoiding UTC day shifts. */
export function generateWeeklyOccurrences(startDate, count) {
  if (typeof startDate !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(startDate)) return [];
  const [year, month, day] = startDate.split("-").map(Number);
  const first = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (first.getFullYear() !== year || first.getMonth() !== month - 1 || first.getDate() !== day) return [];
  const total = Math.max(1, Math.min(8, Number.isInteger(Number(count)) ? Number(count) : 1));
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(first);
    date.setDate(date.getDate() + index * 7);
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  });
}

/**
 * Returns copies of prior-week entries that can be moved into targetWeekStart.
 * Entries already present for the same normalized name and date are skipped.
 * targetWeekStart must be a YYYY-MM-DD Monday.
 */
export function getWorkWeekCopies(assignments, targetWeekStart) {
  if (!Array.isArray(assignments) || typeof targetWeekStart !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(targetWeekStart)) return [];
  const [year, month, day] = targetWeekStart.split("-").map(Number);
  const target = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (target.getFullYear() !== year || target.getMonth() !== month - 1 || target.getDate() !== day) return [];
  const previous = new Date(target);
  previous.setDate(previous.getDate() - 7);
  const previousKey = previous.getFullYear() + "-" + String(previous.getMonth() + 1).padStart(2, "0") + "-" + String(previous.getDate()).padStart(2, "0");
  const targetDates = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(target);
    date.setDate(date.getDate() + offset);
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  });
  const existingKeys = new Set(assignments.filter(item => item && typeof item === "object").map(item => item.date + "|" + normaliseAppointmentTitle(item.name)));
  const results = [];
  const previousDates = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(previous);
    date.setDate(date.getDate() + offset);
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  });
  for (const item of assignments) {
    if (!item || typeof item !== "object" || !previousDates.includes(item.date)) continue;
    const offset = previousDates.indexOf(item.date);
    const destDate = targetDates[offset];
    const key = destDate + "|" + normaliseAppointmentTitle(item.name);
    if (!normaliseAppointmentTitle(item.name) || existingKeys.has(key)) continue;
    existingKeys.add(key);
    results.push({ ...item, date: destDate });
  }
  return results;
}
