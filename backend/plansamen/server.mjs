import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'"
};

function sendJson(response, status, payload) {
  response.writeHead(status, JSON_HEADERS);
  response.end(JSON.stringify(payload));
}

/**
 * Safe PlanSamen API boundary scaffold.
 *
 * Fail-closed by design: no identity provider or database is connected, so
 * this server never accepts or persists client, caregiver, appointment, or
 * roster data. Only a minimal health response is available.
 */
export function createPlanSamenApiServer() {
  return createServer((request, response) => {
    let path;
    try {
      path = new URL(request.url ?? "/", "http://localhost").pathname.replace(/\/$/, "") || "/";
    } catch {
      sendJson(response, 400, {
        error: {
          code: "INVALID_REQUEST",
          message: "Ongeldig verzoek.",
          requestId: randomUUID()
        }
      });
      return;
    }

    if (request.method === "GET" && path === "/api/v1/healthz") {
      sendJson(response, 200, {
        status: "prototype",
        backendConfigured: false,
        acceptsPersonalData: false
      });
      return;
    }

    if (path === "/api" || path.startsWith("/api/")) {
      sendJson(response, 503, {
        error: {
          code: "BACKEND_NOT_CONFIGURED",
          message: "Online functies zijn nog niet beschikbaar.",
          requestId: randomUUID()
        }
      });
      return;
    }

    sendJson(response, 404, {
      error: {
        code: "NOT_FOUND",
        message: "Niet gevonden.",
        requestId: randomUUID()
      }
    });
  });
}
