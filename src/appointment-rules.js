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
    if (existing.date !== candidate.date) continue;

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
