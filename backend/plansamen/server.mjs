import { createServer } from "node:http";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY"
};

function sendJson(response, status, payload) {
  response.writeHead(status, JSON_HEADERS);
  response.end(JSON.stringify(payload));
}

/**
 * Safe PlanSamen API boundary scaffold.
 *
 * This is deliberately fail-closed: no identity provider or database is wired
 * in yet, so it must not accept or persist client, caregiver, appointment, or
 * roster data. Only a minimal health response is available.
 */
export function createPlanSamenApiServer() {
  return createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const path = url.pathname.replace(/\/$/, "") || "/";

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
          requestId: "not-configured"
        }
      });
      return;
    }

    sendJson(response, 404, {
      error: {
        code: "NOT_FOUND",
        message: "Niet gevonden."
      }
    });
  });
}
