import test from "node:test";
import assert from "node:assert/strict";
import {
  AppointmentRuleError,
  findAppointmentConflict,
  intervalsOverlap,
  validateAppointmentInterval
} from "../backend/plansamen/appointment-rules.mjs";

const base = {
  clientId: "client-a",
  caregiverId: "caregiver-a",
  startsAt: "2026-10-22T10:00:00.000Z",
  endsAt: "2026-10-22T11:00:00.000Z",
  status: "scheduled"
};

test("appointments that touch at an endpoint are not overlapping", () => {
  const first = { ...base };
  const next = {
    ...base,
    startsAt: "2026-10-22T11:00:00.000Z",
    endsAt: "2026-10-22T12:00:00.000Z"
  };
  assert.equal(intervalsOverlap(first, next), false);
  assert.equal(findAppointmentConflict(next, [first]), null);
});

test("overlapping appointments for the same client are rejected", () => {
  const existing = { ...base, caregiverId: null };
  const candidate = {
    ...base,
    caregiverId: null,
    startsAt: "2026-10-22T10:30:00.000Z"
  };
  assert.deepEqual(findAppointmentConflict(candidate, [existing]), {
    code: "APPOINTMENT_OVERLAP",
    scope: "client"
  });
});

test("overlapping appointments for the same caregiver are rejected across clients", () => {
  const existing = { ...base, clientId: "client-a" };
  const candidate = {
    ...base,
    clientId: "client-b",
    startsAt: "2026-10-22T10:30:00.000Z"
  };
  assert.deepEqual(findAppointmentConflict(candidate, [existing]), {
    code: "APPOINTMENT_OVERLAP",
    scope: "caregiver"
  });
});

test("cancelled appointments do not block a new appointment", () => {
  const cancelled = { ...base, status: "cancelled" };
  assert.equal(findAppointmentConflict(base, [cancelled]), null);
  assert.equal(findAppointmentConflict({ ...base, status: "cancelled" }, [base]), null);
});

test("invalid intervals fail with a safe validation error", () => {
  assert.throws(
    () => validateAppointmentInterval({ ...base, endsAt: base.startsAt }),
    error => error instanceof AppointmentRuleError && error.code === "VALIDATION_ERROR"
  );
  assert.throws(
    () => validateAppointmentInterval({ ...base, startsAt: "not-a-date" }),
    error => error instanceof AppointmentRuleError && error.code === "VALIDATION_ERROR"
  );
});

test("conflict responses never contain private appointment fields", () => {
  const existing = {
    ...base,
    title: "Persoonlijke afspraak",
    notes: "Privé-informatie"
  };
  const result = findAppointmentConflict(base, [existing]);
  assert.deepEqual(result, { code: "APPOINTMENT_OVERLAP", scope: "client" });
  assert.equal(Object.hasOwn(result, "title"), false);
  assert.equal(Object.hasOwn(result, "notes"), false);
});
