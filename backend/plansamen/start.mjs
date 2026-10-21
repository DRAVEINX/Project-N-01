import { createPlanSamenApiServer } from "./server.mjs";

const portText = process.env.PORT ?? "4179";
const port = Number(portText);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const host = "127.0.0.1";
const server = createPlanSamenApiServer();

server.on("error", error => {
  console.error("PlanSamen prototype API could not start:", error.message);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`PlanSamen prototype API listening on http://${host}:${port}`);
  console.log("Safety mode: no authentication, no database, no personal data accepted.");
});

function shutdown(signal) {
  server.close(error => {
    if (error) {
      console.error("PlanSamen prototype API shutdown failed:", error.message);
      process.exitCode = 1;
    }
    process.exit();
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
