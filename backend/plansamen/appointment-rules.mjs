/**
 * Provider-neutral appointment rules for the future trusted PlanSamen service.
 * This module is deliberately not wired to the public API scaffold: without
 * authentication and a transactional database, it must not accept live data.
 */

export class AppointmentRuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AppointmentRuleError";
    this.code = code;
  }
}

function parseInstant(value, field) {
  const isoTimestamp = typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (!isoTimestamp) {
    throw new AppointmentRuleError(
      "VALIDATION_ERROR",
      `${field} must be an ISO timestamp with an explicit timezone.`
    );
  }

  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value);
  const [, year, month, day, hour, minute, second] = parts;
  const calendarDate = new Date(0);
  calendarDate.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  calendarDate.setUTCHours(0, 0, 0, 0);
  if (
    calendarDate.getUTCFullYear() !== Number(year) ||
    calendarDate.getUTCMonth() !== Number(month) - 1 ||
    calendarDate.getUTCDate() !== Number(day) ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  ) {
    throw new AppointmentRuleError("VALIDATION_ERROR", `${field} must be a valid ISO timestamp.`);
  }

  // Validate the numeric timezone offset explicitly. Date.parse behavior for
  // malformed offsets can vary between runtimes, so never rely on it alone.
  const offset = /([+-])(\d{2}):(\d{2})$/.exec(value);
  const offsetHours = offset ? Number(offset[2]) : 0;
  const offsetMinutes = offset ? Number(offset[3]) : 0;
  // ISO 8601 civil offsets are bounded at 14:00; accepting larger offsets
  // can silently shift appointments to an unintended calendar day.
  if (offset && (offsetHours > 14 || offsetMinutes > 59 ||
      (offsetHours === 14 && offsetMinutes !== 0))) {
    throw new AppointmentRuleError("VALIDATION_ERROR", `${field} must use a valid timezone offset.`);
  }

  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    throw new AppointmentRuleError("VALIDATION_ERROR", `${field} must be a valid ISO timestamp.`);
  }
  return time;
}

/**
 * Validate one appointment and return normalized epoch-millisecond boundaries.
 * The caller must still authorize the actor and enforce the rule transactionally
 * in the database to protect against concurrent requests.
 */
export function validateAppointmentInterval(appointment) {
  if (!appointment || typeof appointment !== "object" || Array.isArray(appointment)) {
    throw new AppointmentRuleError("VALIDATION_ERROR", "An appointment object is required.");
  }
  const start = parseInstant(appointment.startsAt, "startsAt");
  const end = parseInstant(appointment.endsAt, "endsAt");
  if (end <= start) {
    throw new AppointmentRuleError("VALIDATION_ERROR", "endsAt must be after startsAt.");
  }
  if (typeof appointment.clientId !== "string" || !appointment.clientId.trim()) {
    throw new AppointmentRuleError("VALIDATION_ERROR", "clientId is required.");
  }
  if (appointment.caregiverId != null &&
      (typeof appointment.caregiverId !== "string" || !appointment.caregiverId.trim())) {
    throw new AppointmentRuleError("VALIDATION_ERROR", "caregiverId must be a non-empty identifier or null.");
  }
  return { start, end };
}

/** Half-open intervals permit appointments to touch without overlapping. */
export function intervalsOverlap(left, right) {
  const a = validateAppointmentInterval(left);
  const b = validateAppointmentInterval(right);
  return a.start < b.end && b.start < a.end;
}

/**
 * Return a safe conflict code, never the conflicting appointment's title,
 * notes, client identifier, or other private details.
 */
export function findAppointmentConflict(candidate, existingAppointments) {
  const candidateInterval = validateAppointmentInterval(candidate);
  if (!Array.isArray(existingAppointments)) {
    throw new AppointmentRuleError("VALIDATION_ERROR", "existingAppointments must be an array.");
  }
  if (candidate.status === "cancelled") return null;

  for (const existing of existingAppointments) {
    if (!existing || existing.status === "cancelled" || (candidate.id != null && existing.id === candidate.id)) continue;
    const existingInterval = validateAppointmentInterval(existing);
    const overlaps = candidateInterval.start < existingInterval.end &&
      existingInterval.start < candidateInterval.end;
    if (!overlaps) continue;

    if (candidate.clientId === existing.clientId) {
      return { code: "APPOINTMENT_OVERLAP", scope: "client" };
    }
    if (candidate.caregiverId != null && candidate.caregiverId === existing.caregiverId) {
      return { code: "APPOINTMENT_OVERLAP", scope: "caregiver" };
    }
  }
  return null;
}
