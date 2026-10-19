# NovaLife PostgreSQL authentication HTTP composition

`createNovaLifeAuthHttpHandler({ pool, audit, rateLimit, now, ttlMs })` composes the PostgreSQL-backed Argon2id authentication runtime with the Fetch API handler.

The supplied `pool` must use private connection credentials and appropriate TLS/database permissions. `audit` must write to a durable, access-controlled audit destination. `rateLimit` is mandatory and must fail closed; use a trusted hosting-layer identity and a durable limiter appropriate to the deployment.

The returned value is a request handler, not a listening server. Mount behind HTTPS and configure secure token handling, CORS/cookie/CSRF decisions where applicable, request limits at the edge, secrets management, monitoring, account recovery, and independent security/privacy review before handling real care data.

The PostgreSQL integration workflow tests the composed login → current actor → logout lifecycle using synthetic accounts and an ephemeral database. It does not certify a production deployment.
