import test from "node:test";
import assert from "node:assert/strict";
import { createAppointmentService } from "./appointment-service.mjs";
import { AppointmentRuleError } from "./appointment-rules.mjs";

const validInput = {
  clientId: "client-1",
  caregiverId: null,
  startsAt: "2026-11-02T10:00:00+01:00",
  endsAt: "2026-11-02T11:00:00+01:00",
  title: "Dagplanning",
  pictogram: "📅",
  notes: ""
};

function repositoryWith(transactionOverrides = {}) {
  const calls = [];
  const transaction = {
    async hasActiveRelationship(caregiverId, clientId) {
      calls.push(["relationship", caregiverId, clientId]);
      return true;
    },
    async findPotentialConflicts(query) {
      calls.push(["conflicts", query]);
      return [];
    },
    async insertAppointment(record) {
      calls.push(["insert", record]);
      return { id: "appointment-1", ...record };
    },
    ...transactionOverrides
  };
  return {
    calls,
    async withTransaction(callback) {
      calls.push(["begin"]);
      try {
        const result = await callback(transaction);
        calls.push(["commit"]);
        return result;
      } catch (error) {
        calls.push(["rollback"]);
        throw error;
      }
    }
  };
}

test("create requires a transactional repository", () => {
  assert.throws(() => createAppointmentService(null), /transactional repository/i);
  assert.throws(() => createAppointmentService({}), /transactional repository/i);
});

test("client cannot create an appointment for another client", async () => {
  const repository = repositoryWith();
  const service = createAppointmentService(repository);

  await assert.rejects(
    service.create({ actor: { userId: "client-1", role: "client" }, input: { ...validInput, clientId: "client-2" } }),
    error => error instanceof AppointmentRuleError && error.code === "FORBIDDEN"
  );
  assert.deepEqual(repository.calls, []);
});

test("caregiver relationship is checked inside the transaction before insert", async () => {
  const repository = repositoryWith({
    async hasActiveRelationship() {
      return false;
    }
  });
  const service = createAppointmentService(repository);

  await assert.rejects(
    service.create({ actor: { userId: "caregiver-1", role: "caregiver" }, input: validInput }),
    error => error instanceof AppointmentRuleError && error.code === "FORBIDDEN"
  );
  assert.deepEqual(repository.calls.map(call => call[0]), ["begin", "rollback"]);
});

test("successful client appointment is inserted through the transaction", async () => {
  const repository = repositoryWith();
  const service = createAppointmentService(repository);
  const result = await service.create({
    actor: { userId: "client-1", role: "client" },
    input: validInput
  });

  assert.equal(result.id, "appointment-1");
  assert.equal(repository.calls[0][0], "begin");
  assert.equal(repository.calls.at(-1)[0], "commit");
  const inserted = repository.calls.find(call => call[0] === "insert")[1];
  assert.equal(inserted.createdByUserId, "client-1");
  assert.equal(inserted.status, "scheduled");
});

test("overlap conflicts stop insertion and roll back", async () => {
  const repository = repositoryWith({
    async findPotentialConflicts() {
      return [{
        id: "existing",
        clientId: "client-1",
        caregiverId: null,
        startsAt: "2026-11-02T10:30:00+01:00",
        endsAt: "2026-11-02T11:30:00+01:00",
        status: "scheduled"
      }];
    }
  });
  const service = createAppointmentService(repository);

  await assert.rejects(
    service.create({ actor: { userId: "client-1", role: "client" }, input: validInput }),
    error => error instanceof AppointmentRuleError && error.code === "APPOINTMENT_OVERLAP"
  );
  assert.equal(repository.calls.some(call => call[0] === "insert"), false);
  assert.equal(repository.calls.at(-1)[0], "rollback");
});

test("database exclusion violations become safe overlap errors", async () => {
  const repository = {
    async withTransaction() {
      const error = new Error("private database detail");
      error.code = "23P01";
      throw error;
    }
  };
  const service = createAppointmentService(repository);

  await assert.rejects(
    service.create({ actor: { userId: "client-1", role: "client" }, input: validInput }),
    error => error instanceof AppointmentRuleError &&
      error.code === "APPOINTMENT_OVERLAP" &&
      !error.message.includes("private database detail")
  );
});

test("invalid appointment input is rejected before opening a transaction", async () => {
  const repository = repositoryWith();
  const service = createAppointmentService(repository);

  await assert.rejects(
    service.create({
      actor: { userId: "client-1", role: "client" },
      input: { ...validInput, endsAt: validInput.startsAt }
    }),
    error => error instanceof AppointmentRuleError && error.code === "VALIDATION_ERROR"
  );
  assert.deepEqual(repository.calls, []);
});

test("unsupported roles cannot create appointments", async () => {
  const repository = repositoryWith();
  const service = createAppointmentService(repository);

  await assert.rejects(
    service.create({ actor: { userId: "admin-1", role: "admin" }, input: validInput }),
    error => error instanceof AppointmentRuleError && error.code === "FORBIDDEN"
  );
  assert.deepEqual(repository.calls, []);
});

test("caregiver cannot assign another caregiver without an active relationship", async () => {
  let relationshipChecks = 0;
  const repository = repositoryWith({
    async hasActiveRelationship() {
      relationshipChecks += 1;
      return relationshipChecks === 1;
    }
  });
  const service = createAppointmentService(repository);

  await assert.rejects(
    service.create({
      actor: { userId: "caregiver-1", role: "caregiver" },
      input: { ...validInput, caregiverId: "caregiver-2" }
    }),
    error => error instanceof AppointmentRuleError && error.code === "RELATIONSHIP_NOT_ACTIVE"
  );
  assert.equal(repository.calls.some(call => call[0] === "insert"), false);
  assert.equal(repository.calls.at(-1)[0], "rollback");
});

test("oversized notes are rejected before opening a transaction", async () => {
  const repository = repositoryWith();
  const service = createAppointmentService(repository);

  await assert.rejects(
    service.create({
      actor: { userId: "client-1", role: "client" },
      input: { ...validInput, notes: "x".repeat(4001) }
    }),
    error => error instanceof AppointmentRuleError && error.code === "VALIDATION_ERROR"
  );
  assert.deepEqual(repository.calls, []);
});

test("missing verified actor is rejected without touching the repository", async () => {
  const repository = repositoryWith();
  const service = createAppointmentService(repository);

  await assert.rejects(
    service.create({ actor: null, input: validInput }),
    error => error instanceof AppointmentRuleError && error.code === "UNAUTHENTICATED"
  );
  assert.deepEqual(repository.calls, []);
});

test("client-supplied trusted fields and unknown fields are rejected before transaction", async () => {
  const serviceCases = [
    { ...validInput, role: "admin" },
    { ...validInput, status: "cancelled" },
    { ...validInput, createdByUserId: "attacker" },
    { ...validInput, unexpected: true }
  ];

  for (const input of serviceCases) {
    const repository = repositoryWith();
    const service = createAppointmentService(repository);
    await assert.rejects(
      service.create({ actor: { userId: "client-1", role: "client" }, input }),
      error => error instanceof AppointmentRuleError && error.code === "VALIDATION_ERROR"
    );
    assert.deepEqual(repository.calls, []);
  }
});

test("non-text appointment fields are rejected before transaction", async () => {
  for (const input of [
    { ...validInput, title: { text: "Dagplanning" } },
    { ...validInput, pictogram: ["📅"] },
    { ...validInput, notes: { private: "not text" } }
  ]) {
    const repository = repositoryWith();
    const service = createAppointmentService(repository);
    await assert.rejects(
      service.create({ actor: { userId: "client-1", role: "client" }, input }),
      error => error instanceof AppointmentRuleError && error.code === "VALIDATION_ERROR"
    );
    assert.deepEqual(repository.calls, []);
  }
});


test("client cannot assign a caregiver without an active relationship", async () => {
  const repository = repositoryWith({
    async hasActiveRelationship() {
      return false;
    }
  });
  const service = createAppointmentService(repository);

  await assert.rejects(
    service.create({
      actor: { userId: "client-1", role: "client" },
      input: { ...validInput, caregiverId: "caregiver-unlinked" }
    }),
    error => error instanceof AppointmentRuleError && error.code === "RELATIONSHIP_NOT_ACTIVE"
  );
  assert.equal(repository.calls.some(call => call[0] === "insert"), false);
  assert.equal(repository.calls.at(-1)[0], "rollback");
});

test("client can assign only a caregiver confirmed by the transactional relationship lookup", async () => {
  const relationshipCalls = [];
  const repository = repositoryWith({
    async hasActiveRelationship(caregiverId, clientId) {
      relationshipCalls.push([caregiverId, clientId]);
      return caregiverId === "caregiver-1" && clientId === "client-1";
    }
  });
  const service = createAppointmentService(repository);

  const result = await service.create({
    actor: { userId: "client-1", role: "client" },
    input: { ...validInput, caregiverId: "caregiver-1" }
  });

  assert.equal(result.assignedCaregiverUserId ?? result.caregiverId, "caregiver-1");
  assert.deepEqual(relationshipCalls, [["caregiver-1", "client-1"]]);
});
