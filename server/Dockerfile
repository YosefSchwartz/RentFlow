# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# OpenSSL is required by Prisma's query engine.
RUN apk add --no-cache openssl

# Install dependencies (with the pinned Prisma CLI from devDependencies).
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Generate the Prisma client (uses the pinned CLI, not a network-fetched one).
RUN npx prisma generate

# Build the NestJS app.
COPY . .
RUN npm run build

# ---------- Production stage ----------
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# openssl for Prisma at runtime; dumb-init for correct PID 1 signal handling.
RUN apk add --no-cache openssl dumb-init

# Install production dependencies only.
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

# Reuse the Prisma client generated in the builder (correct pinned version,
# no network fetch, no dev Prisma CLI in the final image).
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Application build output.
COPY --from=builder /app/dist ./dist

# Run as a non-root user.
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3000

# Liveness probe against the app's health endpoint (global prefix is /api).
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# dumb-init as PID 1 so SIGTERM/SIGINT reach Node cleanly (graceful ECS stops).
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
