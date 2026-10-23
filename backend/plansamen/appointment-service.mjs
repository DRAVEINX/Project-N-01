import { AppointmentRuleError, findAppointmentConflict, validateAppointmentInterval } from "./appointment-rules.mjs";

/**
 * Application-service boundary for a future authenticated backend.
 *
 * actor must be constructed by trusted authentication middleware, never copied
 * from request JSON. repository must implement real transactions and retain the
 * PostgreSQL exclusion constraints from reference-schema.sql. This service is
 * intentionally not connected to the current API scaffold.
 */
export function createAppointmentService(repository) {
  if (!repository || typeof repository.withTransaction !== "function") {
    throw new TypeError("A transactional repository adapter is required.");
  }

  return {
    async create({ actor, input }) {
      if (!actor || typeof actor.userId !== "string" || !actor.userId.trim()) {
        throw new AppointmentRuleError("UNAUTHENTICATED", "A verified user session is required.");
      }
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new AppointmentRuleError("VALIDATION_ERROR", "Appointment input is required.");
      }

      // Strict allowlist: trusted fields such as role, status and createdByUserId
      // must come from server/database state, never from request input.
      const allowedInputKeys = new Set([
        "clientId", "caregiverId", "startsAt", "endsAt", "title", "pictogram", "notes"
      ]);
      if (Object.keys(input).some(key => !allowedInputKeys.has(key))) {
        throw new AppointmentRuleError("VALIDATION_ERROR", "Appointment input contains unsupported fields.");
      }

      const candidate = {
        clientId: input.clientId,
        caregiverId: input.caregiverId ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: "scheduled"
      };
      validateAppointmentInterval(candidate);

      if (actor.role === "client") {
        if (actor.userId !== candidate.clientId) {
          throw new AppointmentRuleError("FORBIDDEN", "You cannot plan for this client.");
        }
      } else if (actor.role !== "caregiver") {
        throw new AppointmentRuleError("FORBIDDEN", "This role cannot create appointments.");
      }

      // Match the reference schema's constraints before opening a transaction.
      // Reject invalid content consistently instead of relying on DB errors.
      if (input.title !== undefined && typeof input.title !== "string") {
        throw new AppointmentRuleError("VALIDATION_ERROR", "title must be text.");
      }
      if (input.pictogram !== undefined && typeof input.pictogram !== "string") {
        throw new AppointmentRuleError("VALIDATION_ERROR", "pictogram must be text.");
      }
      if (input.notes !== undefined && typeof input.notes !== "string") {
        throw new AppointmentRuleError("VALIDATION_ERROR", "notes must be text.");
      }
      const title = typeof input.title === "string" ? input.title.trim() : "";
      const pictogram = typeof input.pictogram === "string" ? input.pictogram : "📅";
      const notes = typeof input.notes === "string" ? input.notes : "";
      if ([...title].length < 1 || [...title].length > 200) {
        throw new AppointmentRuleError("VALIDATION_ERROR", "title must contain 1 to 200 characters.");
      }
      if ([...pictogram].length > 16) {
        throw new AppointmentRuleError("VALIDATION_ERROR", "pictogram must contain at most 16 characters.");
      }
      if ([...notes].length > 4000) {
        throw new AppointmentRuleError("VALIDATION_ERROR", "notes must contain at most 4000 characters.");
      }

      try {
        return await repository.withTransaction(async transaction => {
          // Relationship checks and the write share one transaction so a
          // revoked caregiver relationship cannot be accepted from a stale
          // pre-transaction check. The adapter must lock/revalidate relationship
          // rows under its transaction isolation policy.
          if (typeof transaction.hasActiveRelationship !== "function") {
            throw new TypeError("Transaction must provide hasActiveRelationship.");
          }
          if (actor.role === "caregiver" &&
              !await transaction.hasActiveRelationship(actor.userId, candidate.clientId)) {
            throw new AppointmentRuleError("FORBIDDEN", "An active client relationship is required.");
          }
          if (candidate.caregiverId !== null) {
            const assignmentAllowed = candidate.caregiverId === actor.userId
              ? actor.role === "caregiver"
              : await transaction.hasActiveRelationship(candidate.caregiverId, candidate.clientId);
            if (!assignmentAllowed) {
              throw new AppointmentRuleError("RELATIONSHIP_NOT_ACTIVE", "The assigned caregiver is not authorized.");
            }
          }

          const existing = await transaction.findPotentialConflicts({
            clientId: candidate.clientId,
            caregiverId: candidate.caregiverId,
            startsAt: candidate.startsAt,
            endsAt: candidate.endsAt
          });
          const conflict = findAppointmentConflict(candidate, existing);
          if (conflict) {
            throw new AppointmentRuleError("APPOINTMENT_OVERLAP", "The time overlaps another appointment.");
          }

          return transaction.insertAppointment({
            clientId: candidate.clientId,
            caregiverId: candidate.caregiverId,
            startsAt: candidate.startsAt,
            endsAt: candidate.endsAt,
            title,
            pictogram,
            notes,
            status: "scheduled",
            createdByUserId: actor.userId
          });
        });
      } catch (error) {
        // PostgreSQL exclusion violations (SQLSTATE 23P01) are the final
        // concurrency-safe guard. Do not leak SQL, row data, or stack traces.
        if (error?.code === "23P01") {
          throw new AppointmentRuleError("APPOINTMENT_OVERLAP", "The time overlaps another appointment.");
        }
        throw error;
      }
    }
  };
}
