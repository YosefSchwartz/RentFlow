# RentFlow

**Property management platform for small and medium landlords.**

RentFlow centralizes properties, tenants, leases, documents, and maintenance requests in one place — replacing the fragmented mix of WhatsApp, email, and shared folders that landlords typically juggle today.

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
| [`server/`](server/) | Backend API — NestJS + Prisma + PostgreSQL |
| [`mobile/`](mobile/) | Mobile app — Expo / React Native |
| [`CLAUDE.md`](CLAUDE.md) | Project conventions, architecture rules, and development guardrails |

Each application has its own detailed `README.md` ([backend](server/README.md), [mobile](mobile/README.md)).

> **Naming transition (KeyNest → RentFlow).** The product is now **RentFlow**;
> all branding, documentation, and AWS resource naming use it. Internal runtime
> identifiers (database name, Docker container/volume/network names, local S3
> bucket names, npm package names, mobile bundle id `com.keynest.app`, and the
> `keynest.app` domain) still use `keynest`. These are technical identifiers,
> not user-facing branding, and are intentionally left unchanged to avoid
> breaking local dev, published-app identity, and DNS. Renaming them is tracked
> as separate follow-up work (see [risks](#naming-follow-ups) below).

---

## Core domain

The central business entity is the **Lease** — the active relationship between a **Property** and a **Tenant**.

There is no separate `TenantAssignment` model. Tenant onboarding happens through the Lease itself:

1. A landlord creates a Lease on a Property (initially tenant-less, `PENDING`).
2. The Lease carries a per-lease `activationCode` (with an expiry).
3. The landlord shares the code; a tenant redeems it (`POST /leases/redeem`) to become the Lease's tenant. The code is consumed on redemption.

`LeaseStatus` is `PENDING | ACTIVE | ENDED`, and `Lease.tenantId` is nullable until a tenant redeems the code. Future features (contracts, signatures, rent payments, renewals, deposit tracking) attach to the Lease.

---

## Backend (`server/`)

**Stack:** NestJS · TypeScript · Prisma · PostgreSQL

- Module-based architecture, REST API under a global `/api` prefix
- JWT access tokens (15m) + rotating refresh tokens (30d, DB-backed `Session`)
- Authorization enforced inside services, based on ownership and active-lease relationships (no `@Roles` decorator)
- Shared `StoredFile` pipeline over an S3 storage provider (LocalStack in dev)

**Implemented modules:** `auth`, `users`, `properties`, `leases`, `documents`, `folders`, `receipts`, `ai`, `property-media`, `maintenance`, `notifications`, `media` + `storage`, `prisma`.

**Document platform.** Documents file into a per-property **folder** tree (six
undeletable system folders per property) with an extensible permission model
(`LANDLORD_ONLY` / `LANDLORD_AND_TENANT`) and a full audit log. **Receipts** are
first-class documents with structured metadata (date, tax year, source), auto-
filed under `Receipts → <tax year>`, with a per-year dashboard and CSV/ZIP
export. An **AI platform** analyzes documents asynchronously (summary, category
suggestion, normalized extracted fields) through a provider-agnostic
`AIProvider` abstraction — AWS Bedrock is the first provider, with a mock
provider for local/dev; the AI prediction never overwrites the user's decision.

### Getting started

```bash
cd server
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

## Mobile (`mobile/`)

**Stack:** Expo (SDK 54) · React Native · TypeScript · React Query · Axios · i18next · React Native Paper

- Feature-based screens (`auth` / `landlord` / `tenant` / `shared`)
- React Navigation: root stack → bottom tabs (Properties / Rentals / Profile)
- SecureStore for tokens; an Axios interceptor auto-refreshes on `401`
- Landlord vs. tenant is a runtime "experience" toggle, not an account role — both tab stacks are always available to every user

### Getting started

```bash
cd mobile
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

Development is local-first. **Staging runs on AWS**, fully managed as
Infrastructure-as-Code (OpenTofu) under [`infrastructure/`](infrastructure/):
ECS Fargate behind an ALB, RDS PostgreSQL (private), S3, ECR, and AWS Bedrock
(AI) — all least-privilege via the ECS task role, no static credentials.
Deploys run through GitHub Actions OIDC (`.github/workflows/backend-deploy.yml`):
build image → `prisma migrate deploy` (one-off in-VPC task) → rolling ECS
update. CloudFront and Route 53/ACM remain future work. (An `identity` Cognito
module exists in Terraform but the app currently signs its own JWTs and uses
DB-backed sessions rather than Cognito.)

---

## Contributing conventions

Before making changes, read [`CLAUDE.md`](CLAUDE.md). It documents the architecture rules, the feature-completion checklist, and the guardrails every change is expected to follow (API contract validation, localization, RTL, permissions, notifications, and more).

Guiding principle: **choose the simplest solution that scales reasonably.** Prefer simplicity, maintainability, clear UX, and incremental evolution over rewrites.

---

## Naming follow-ups

The KeyNest → RentFlow rebrand renamed all branding, documentation, and AWS
resource naming. The following **internal `keynest` identifiers** were left
unchanged on purpose (renaming them risks breaking running systems and delivers
no user-facing value). Tackle them deliberately, each with its own migration:

| Identifier | Where | Why deferred |
| --- | --- | --- |
| Database name / user / password | `docker-compose*.yml`, `.env*` (`keynest` / `keynest_secret`) | Coupled across compose, env, and Prisma; requires recreating local volumes. |
| Docker resources | container/network names (`keynest-db`, `keynest-network`, …) | Cosmetic; recreate on next `up`. |
| Local S3 bucket / Secrets names | `keynest-local-documents`, `keynest-legal`, `keynest/local/app-secrets` | Coupled to LocalStack init + code defaults + env; rename all together. |
| npm package names | `server/package.json`, `mobile/package.json` (`keynest` / `keynest-mobile`) | Internal; safe but low value. |
| Mobile bundle id / slug | `com.keynest.app`, slug `keynest` | Changing published-app identity is a store-level decision, not a rename. |
| App domain | `keynest.app` (mobile links, legal pages) | Depends on a real DNS/domain decision (Route 53/ACM). |

The mobile i18n key `auth.joinKeynest` also retains the old spelling (its
*value* now reads "RentFlow"); rename the key when convenient.
