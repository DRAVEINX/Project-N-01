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
  if (!repository || typeof repository.withTransaction !== "function" ||
      typeof repository.hasActiveRelationship !== "function") {
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
      } else if (actor.role === "caregiver") {
        const active = await repository.hasActiveRelationship(actor.userId, candidate.clientId);
        if (!active) {
          throw new AppointmentRuleError("FORBIDDEN", "An active client relationship is required.");
        }
      } else {
        throw new AppointmentRuleError("FORBIDDEN", "This role cannot create appointments.");
      }

      if (candidate.caregiverId !== null) {
        const assignmentAllowed = candidate.caregiverId === actor.userId
          ? actor.role === "caregiver"
          : await repository.hasActiveRelationship(candidate.caregiverId, candidate.clientId);
        if (!assignmentAllowed) {
          throw new AppointmentRuleError("RELATIONSHIP_NOT_ACTIVE", "The assigned caregiver is not authorized.");
        }
      }

      // Match the reference schema's constraints before opening a transaction.
      // Reject invalid content consistently instead of relying on DB errors.
      const title = typeof input.title === "string" ? input.title.trim() : "";
      const pictogram = typeof input.pictogram === "string" ? input.pictogram : "📅";
      const notes = typeof input.notes === "string" ? input.notes : "";
      if (title.length < 1 || title.length > 200) {
        throw new AppointmentRuleError("VALIDATION_ERROR", "title must contain 1 to 200 characters.");
      }
      if ([...pictogram].length > 16) {
        throw new AppointmentRuleError("VALIDATION_ERROR", "pictogram must contain at most 16 characters.");
      }
      if (notes.length > 4000) {
        throw new AppointmentRuleError("VALIDATION_ERROR", "notes must contain at most 4000 characters.");
      }

      try {
        return await repository.withTransaction(async transaction => {
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
