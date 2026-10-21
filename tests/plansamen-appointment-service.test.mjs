import test from "node:test";
import assert from "node:assert/strict";
import { createAppointmentService } from "../backend/plansamen/appointment-service.mjs";
import { AppointmentRuleError } from "../backend/plansamen/appointment-rules.mjs";

const appointment = {
  clientId: "client-1",
  caregiverId: "caregiver-1",
  startsAt: "2026-10-22T10:00:00.000Z",
  endsAt: "2026-10-22T11:00:00.000Z",
  title: "Afspraak",
  notes: "privé"
};

function repository({ existing = [], relationships = [] } = {}) {
  const inserted = [];
  return {
    inserted,
    hasActiveRelationship: async (caregiverId, clientId) =>
      relationships.includes(`${caregiverId}:${clientId}`),
    withTransaction: async callback => callback({
      findPotentialConflicts: async () => existing,
      insertAppointment: async record => {
        inserted.push(record);
        return { id: "new-1", ...record };
      }
    })
  };
}

async function expectCode(promise, code) {
  await assert.rejects(promise, error => {
    assert.ok(error instanceof AppointmentRuleError);
    assert.equal(error.code, code);
    return true;
  });
}

test("service rejects missing trusted actor before writing", async () => {
  const repo = repository();
  await expectCode(createAppointmentService(repo).create({ actor: null, input: appointment }), "UNAUTHENTICATED");
  assert.equal(repo.inserted.length, 0);
});

test("client can only create appointments for their own client identity", async () => {
  const repo = repository();
  const service = createAppointmentService(repo);
  await expectCode(service.create({
    actor: { userId: "client-2", role: "client" },
    input: appointment
  }), "FORBIDDEN");
  assert.equal(repo.inserted.length, 0);
});

test("caregiver without active relationship is denied", async () => {
  const repo = repository();
  await expectCode(createAppointmentService(repo).create({
    actor: { userId: "caregiver-2", role: "caregiver" },
    input: { ...appointment, caregiverId: null }
  }), "FORBIDDEN");
  assert.equal(repo.inserted.length, 0);
});

test("authorized client creation records actor from trusted context", async () => {
  const repo = repository();
  const result = await createAppointmentService(repo).create({
    actor: { userId: "client-1", role: "client" },
    input: { ...appointment, caregiverId: null, createdByUserId: "forged-user" }
  });
  assert.equal(result.createdByUserId, "client-1");
  assert.equal(repo.inserted.length, 1);
  assert.equal(repo.inserted[0].createdByUserId, "client-1");
});

test("caregiver assignment requires an active client relationship", async () => {
  const repo = repository();
  await expectCode(createAppointmentService(repo).create({
    actor: { userId: "client-1", role: "client" },
    input: appointment
  }), "RELATIONSHIP_NOT_ACTIVE");
  assert.equal(repo.inserted.length, 0);
});

test("existing overlap is rejected without leaking appointment details", async () => {
  const repo = repository({
    existing: [{
      id: "private-appointment",
      clientId: "client-1",
      caregiverId: null,
      startsAt: "2026-10-22T10:30:00.000Z",
      endsAt: "2026-10-22T11:30:00.000Z",
      title: "Sensitive title",
      notes: "Sensitive notes",
      status: "scheduled"
    }]
  });
  try {
    await createAppointmentService(repo).create({
      actor: { userId: "client-1", role: "client" },
      input: { ...appointment, caregiverId: null }
    });
    assert.fail("Expected overlap rejection");
  } catch (error) {
    assert.equal(error.code, "APPOINTMENT_OVERLAP");
    assert.doesNotMatch(error.message, /Sensitive title|Sensitive notes|private-appointment/);
  }
  assert.equal(repo.inserted.length, 0);
});

test("database exclusion violation is translated to a safe conflict error", async () => {
  const repo = repository();
  repo.withTransaction = async () => { throw Object.assign(new Error("private SQL detail"), { code: "23P01" }); };
  await expectCode(createAppointmentService(repo).create({
    actor: { userId: "client-1", role: "client" },
    input: { ...appointment, caregiverId: null }
  }), "APPOINTMENT_OVERLAP");
});
