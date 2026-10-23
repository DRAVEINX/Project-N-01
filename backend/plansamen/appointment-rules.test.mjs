import test from "node:test";
import assert from "node:assert/strict";
import {
  AppointmentRuleError,
  findAppointmentConflict,
  intervalsOverlap,
  validateAppointmentInterval
} from "./appointment-rules.mjs";

const base = {
  clientId: "client-a",
  caregiverId: "caregiver-a",
  startsAt: "2026-11-02T10:00:00+01:00",
  endsAt: "2026-11-02T11:00:00+01:00",
  status: "scheduled"
};

function rejectsValidation(fn) {
  assert.throws(fn, error =>
    error instanceof AppointmentRuleError && error.code === "VALIDATION_ERROR"
  );
}

test("valid explicit-offset timestamps normalize to instants", () => {
  const result = validateAppointmentInterval(base);
  assert.equal(result.start, Date.parse("2026-11-02T09:00:00Z"));
  assert.equal(result.end, Date.parse("2026-11-02T10:00:00Z"));
});

test("timestamps without timezone and impossible calendar dates are rejected", () => {
  rejectsValidation(() => validateAppointmentInterval({
    ...base,
    startsAt: "2026-11-02T10:00:00"
  }));
  rejectsValidation(() => validateAppointmentInterval({
    ...base,
    startsAt: "2026-02-30T10:00:00Z"
  }));
  rejectsValidation(() => validateAppointmentInterval({
    ...base,
    startsAt: "2026-11-02T25:00:00Z"
  }));
});

test("invalid numeric timezone offsets are rejected", () => {
  rejectsValidation(() => validateAppointmentInterval({
    ...base,
    startsAt: "2026-11-02T10:00:00+25:00"
  }));
  rejectsValidation(() => validateAppointmentInterval({
    ...base,
    startsAt: "2026-11-02T10:00:00+01:99"
  }));
});

test("timezone offsets beyond the ISO 8601 civil limit are rejected", () => {
  rejectsValidation(() => validateAppointmentInterval({
    ...base,
    startsAt: "2026-11-02T10:00:00+14:01"
  }));
  rejectsValidation(() => validateAppointmentInterval({
    ...base,
    startsAt: "2026-11-02T10:00:00-15:00"
  }));
  // The maximum valid offset remains accepted.
  assert.equal(validateAppointmentInterval({
    ...base,
    startsAt: "2026-11-02T10:00:00+14:00",
    endsAt: "2026-11-02T11:00:00+14:00"
  }).end > validateAppointmentInterval({
    ...base,
    startsAt: "2026-11-02T10:00:00+14:00",
    endsAt: "2026-11-02T11:00:00+14:00"
  }).start, true);
});

test("empty identifiers and reversed intervals are rejected", () => {
  rejectsValidation(() => validateAppointmentInterval({ ...base, clientId: " " }));
  rejectsValidation(() => validateAppointmentInterval({ ...base, caregiverId: " " }));
  rejectsValidation(() => validateAppointmentInterval({
    ...base,
    startsAt: "2026-11-02T11:00:00+01:00",
    endsAt: "2026-11-02T10:00:00+01:00"
  }));
});

test("half-open intervals allow adjacent appointments", () => {
  const next = {
    ...base,
    startsAt: "2026-11-02T11:00:00+01:00",
    endsAt: "2026-11-02T12:00:00+01:00"
  };
  assert.equal(intervalsOverlap(base, next), false);
  assert.equal(findAppointmentConflict(base, [next]), null);
});

test("overlap conflict response reveals only scope and safe code", () => {
  const other = {
    ...base,
    id: "private-id",
    title: "private appointment title",
    notes: "private notes",
    startsAt: "2026-11-02T10:30:00+01:00",
    endsAt: "2026-11-02T11:30:00+01:00",
    clientId: "client-b",
    caregiverId: "caregiver-a"
  };
  const conflict = findAppointmentConflict(base, [other]);
  assert.deepEqual(conflict, { code: "APPOINTMENT_OVERLAP", scope: "caregiver" });
  assert.equal(JSON.stringify(conflict).includes("private"), false);
});

test("cancelled appointments do not block a new appointment", () => {
  const cancelled = {
    ...base,
    status: "cancelled",
    startsAt: "2026-11-02T10:15:00+01:00",
    endsAt: "2026-11-02T10:45:00+01:00"
  };
  assert.equal(findAppointmentConflict(base, [cancelled]), null);
  assert.equal(findAppointmentConflict({ ...base, status: "cancelled" }, [base]), null);
});


test("timestamps with equivalent offsets compare as the same instant", () => {
  const utc = {
    ...base,
    startsAt: "2026-11-02T09:00:00Z",
    endsAt: "2026-11-02T10:00:00Z"
  };
  assert.equal(intervalsOverlap(base, utc), true);
});

test("the same appointment is excluded from its own conflict scan", () => {
  const current = { ...base, id: "appointment-123" };
  assert.equal(findAppointmentConflict(current, [current]), null);
});

test("appointments for different clients and caregivers do not conflict", () => {
  const other = {
    ...base,
    id: "appointment-other",
    clientId: "client-b",
    caregiverId: "caregiver-b",
    startsAt: "2026-11-02T10:15:00+01:00",
    endsAt: "2026-11-02T10:45:00+01:00"
  };
  assert.equal(findAppointmentConflict(base, [other]), null);
});

test("invalid values and arrays are rejected as appointment objects", () => {
  rejectsValidation(() => validateAppointmentInterval(null));
  rejectsValidation(() => validateAppointmentInterval([]));
  rejectsValidation(() => validateAppointmentInterval("appointment"));
  rejectsValidation(() => findAppointmentConflict(base, {}));
});

test("missing caregiver is allowed for a client-only appointment", () => {
  const clientOnly = { ...base, caregiverId: null };
  assert.equal(validateAppointmentInterval(clientOnly).end > validateAppointmentInterval(clientOnly).start, true);
  assert.equal(findAppointmentConflict(clientOnly, [{
    ...base,
    clientId: "client-b",
    caregiverId: "caregiver-a",
    startsAt: "2026-11-02T10:15:00+01:00",
    endsAt: "2026-11-02T10:45:00+01:00"
  }]), null);
});
