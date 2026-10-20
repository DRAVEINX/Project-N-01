import { randomUUID } from "node:crypto";

const CARE_RESOURCES = new Set([
  "mood-report",
  "care-plan",
  "care-note",
  "care-task",
  "care-report",
  "care-document",
  "medication-overview",
  "care-message",
  "care-roster",
  "care-team",
  "care-consent-record",
]);
const MAX_PAGE_SIZE = 100;
const MAX_RECORD_ID = 200;

function requiredId(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_RECORD_ID ||
      value.trim() !== value || /[\u0000-\u001F\u007F/\\?#]/.test(value)) {
    throw new TypeError(label + " must be a safe identifier of at most 200 characters");
  }
  return value;
}

function validResource(resource) {
  if (!CARE_RESOURCES.has(resource)) throw new TypeError("unsupported care record resource");
  return resource;
}

function serializeData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      (Object.getPrototypeOf(data) !== Object.prototype && Object.getPrototypeOf(data) !== null)) {
    throw new TypeError("care record data must be a plain object");
  }
  let encoded;
  try {
    encoded = JSON.stringify(data);
  } catch {
    throw new TypeError("care record data must be JSON serializable");
  }
  if (typeof encoded !== "string" || encoded === "{}" && Object.keys(data).length !== 0) {
    throw new TypeError("care record data must be JSON serializable");
  }
  return encoded;
}

function mapRecord(row) {
  if (!row) return null;
  return Object.freeze({
    id: row.record_id,
    resource: row.resource,
    data: row.data,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/**
 * Tenant-scoped care-record persistence.
 *
 * Call only from a handler that has already authenticated and authorized the
 * actor. Always pass context.clientId from the authorization result; never use
 * an untrusted client ID from request JSON as the storage scope.
 */
export function createPostgresCareRecordRepository({ pool, idFactory = randomUUID } = {}) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("pool.query is required");
  if (typeof idFactory !== "function") throw new TypeError("idFactory must be a function");

  return Object.freeze({
    async list({ clientId, resource, limit = 50 } = {}) {
      requiredId(clientId, "clientId");
      validResource(resource);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
        throw new TypeError("limit must be an integer between 1 and 100");
      }
      const result = await pool.query(
        `SELECT client_id, resource, record_id, data, created_by, updated_by, created_at, updated_at
           FROM novalife_care_records
          WHERE client_id = $1 AND resource = $2
          ORDER BY updated_at DESC, record_id ASC
          LIMIT $3`,
        [clientId, resource, limit]
      );
      return Object.freeze((result?.rows ?? []).map(mapRecord));
    },

    async get({ clientId, resource, id } = {}) {
      requiredId(clientId, "clientId");
      validResource(resource);
      requiredId(id, "id");
      const result = await pool.query(
        `SELECT client_id, resource, record_id, data, created_by, updated_by, created_at, updated_at
           FROM novalife_care_records
          WHERE client_id = $1 AND resource = $2 AND record_id = $3
          LIMIT 1`,
        [clientId, resource, id]
      );
      return mapRecord(result?.rows?.[0]);
    },

    async create({ clientId, resource, actorId, data } = {}) {
      requiredId(clientId, "clientId");
      validResource(resource);
      requiredId(actorId, "actorId");
      const encoded = serializeData(data);
      const id = requiredId(idFactory(), "generated record id");
      const result = await pool.query(
        `INSERT INTO novalife_care_records
           (client_id, resource, record_id, data, created_by, updated_by)
         VALUES ($1, $2, $3, $4::jsonb, $5, $5)
         RETURNING client_id, resource, record_id, data, created_by, updated_by, created_at, updated_at`,
        [clientId, resource, id, encoded, actorId]
      );
      return mapRecord(result?.rows?.[0]);
    },

    async update({ clientId, resource, id, actorId, data } = {}) {
      requiredId(clientId, "clientId");
      validResource(resource);
      requiredId(id, "id");
      requiredId(actorId, "actorId");
      const encoded = serializeData(data);
      const result = await pool.query(
        `UPDATE novalife_care_records
            SET data = $4::jsonb, updated_by = $5, updated_at = now()
          WHERE client_id = $1 AND resource = $2 AND record_id = $3
          RETURNING client_id, resource, record_id, data, created_by, updated_by, created_at, updated_at`,
        [clientId, resource, id, encoded, actorId]
      );
      return mapRecord(result?.rows?.[0]);
    },

    async remove({ clientId, resource, id } = {}) {
      requiredId(clientId, "clientId");
      validResource(resource);
      requiredId(id, "id");
      const result = await pool.query(
        `DELETE FROM novalife_care_records
          WHERE client_id = $1 AND resource = $2 AND record_id = $3
          RETURNING record_id`,
        [clientId, resource, id]
      );
      return result?.rows?.length === 1;
    },
  });
}
