# Build production dependencies, including the native Argon2id module.
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Runtime image contains only the API server, runtime modules, and its imports.
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080
WORKDIR /app

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src/server ./src/server
COPY --chown=node:node src/authorization-policy.js ./src/authorization-policy.js
COPY --chown=node:node scripts/novalife-care-api-server.mjs ./scripts/novalife-care-api-server.mjs

USER node
EXPOSE 8080
CMD ["node", "scripts/novalife-care-api-server.mjs"]
