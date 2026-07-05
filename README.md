# KeyNest

**Property management platform for small and medium landlords.**

KeyNest centralizes properties, tenants, leases, documents, and maintenance requests in one place — replacing the fragmented mix of WhatsApp, email, and shared folders that landlords typically juggle today.

### Who it's for

- Landlords managing 2–20 properties
- Property managers
- Tenants renting through the platform

A single account supports both experiences: the same user can **own properties** and **rent properties** at the same time. There are no `LANDLORD` / `TENANT` roles — permissions are derived from ownership and active lease relationships.

---

## Repository layout

This is a monorepo containing two applications plus shared context.

| Path | Description |
| --- | --- |
| [`keynest/`](keynest/) | Backend API — NestJS + Prisma + PostgreSQL |
| [`keynest-mobile/`](keynest-mobile/) | Mobile app — Expo / React Native |
| [`CLAUDE.md`](CLAUDE.md) | Project conventions, architecture rules, and development guardrails |

Each application has its own detailed `README.md` ([backend](keynest/README.md), [mobile](keynest-mobile/README.md)).

---

## Core domain

The central business entity is the **Lease** — the active relationship between a **Property** and a **Tenant**.

There is no separate `TenantAssignment` model. Tenant onboarding happens through the Lease itself:

1. A landlord creates a Lease on a Property (initially tenant-less, `PENDING`).
2. The Lease carries a per-lease `activationCode` (with an expiry).
3. The landlord shares the code; a tenant redeems it (`POST /leases/redeem`) to become the Lease's tenant. The code is consumed on redemption.

`LeaseStatus` is `PENDING | ACTIVE | ENDED`, and `Lease.tenantId` is nullable until a tenant redeems the code. Future features (contracts, signatures, rent payments, renewals, deposit tracking) attach to the Lease.

---

## Backend (`keynest/`)

**Stack:** NestJS · TypeScript · Prisma · PostgreSQL

- Module-based architecture, REST API under a global `/api` prefix
- JWT access tokens (15m) + rotating refresh tokens (30d, DB-backed `Session`)
- Authorization enforced inside services, based on ownership and active-lease relationships (no `@Roles` decorator)
- Shared `StoredFile` pipeline over an S3 storage provider (LocalStack in dev)

**Implemented modules:** `auth`, `users`, `properties`, `leases`, `documents`, `property-media`, `maintenance`, `notifications`, `media` + `storage`, `prisma`.

### Getting started

```bash
cd keynest
npm install
cp .env.example .env          # configure DB + storage credentials

npm run services:start        # start PostgreSQL + LocalStack (Docker)
npm run prisma:migrate        # apply database migrations
npm run prisma:seed           # optional: seed sample data

npm run start:dev             # start the API in watch mode
```

Or, in one step: `npm run dev` (starts services, then the API in watch mode).

Useful scripts: `npm run prisma:studio` (DB GUI), `npm run db:reset` (reset DB), `npm test` (unit tests), `npm run test:e2e` (e2e tests).

---

## Mobile (`keynest-mobile/`)

**Stack:** Expo (SDK 54) · React Native · TypeScript · React Query · Axios · i18next · React Native Paper

- Feature-based screens (`auth` / `landlord` / `tenant` / `shared`)
- React Navigation: root stack → bottom tabs (Properties / Rentals / Profile)
- SecureStore for tokens; an Axios interceptor auto-refreshes on `401`
- Landlord vs. tenant is a runtime "experience" toggle, not an account role — both tab stacks are always available to every user

### Getting started

```bash
cd keynest-mobile
npm install
cp .env.example .env          # point API_URL at your running backend

npm start                     # start the Expo dev server
npm run ios                   # or: run on iOS simulator
npm run android               # or: run on Android emulator
```

---

## Localization & RTL

All UI supports **English (LTR)** and **Hebrew (RTL)** via i18next. UI strings use translation keys only — no hardcoded text, no hardcoded alignment.

---

## Deployment direction

Development is local-first. The future deployment target is AWS: ECS Fargate, RDS PostgreSQL, S3, CloudFront, and Cognito.

---

## Contributing conventions

Before making changes, read [`CLAUDE.md`](CLAUDE.md). It documents the architecture rules, the feature-completion checklist, and the guardrails every change is expected to follow (API contract validation, localization, RTL, permissions, notifications, and more).

Guiding principle: **choose the simplest solution that scales reasonably.** Prefer simplicity, maintainability, clear UX, and incremental evolution over rewrites.
