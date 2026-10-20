import { defineRailway, github, project, service } from "railway/iac";

// Infrastructure definition only; no service is created until this file is
// applied with an authenticated Railway account. Sensitive values are set in
// Railway's Variables UI or secret manager, never in this repository.
export default defineRailway(() => {
  const api = service("novalife-care-api", {
    source: github("DRAVEINX/Project-N-01", {
      branch: "feature/novalife-care-api-router",
    }),
    healthcheck: "/healthz",
    healthcheckTimeout: 120,
    start: "node scripts/novalife-care-api-server.mjs",
    env: {
      NODE_ENV: "production",
      HOST: "0.0.0.0",
      NOVALIFE_TRUST_PROXY: "true",
    },
  });

  return project("novalife-care-api", {
    resources: [api],
  });
});
