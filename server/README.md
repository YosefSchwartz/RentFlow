# RentFlow

Property management platform for landlords managing 2-20 rental properties.

This is the RentFlow **backend** (REST API). The Expo/React Native client lives
in [`../mobile`](../mobile).

## Tech Stack

- NestJS 10 (TypeScript)
- Prisma 5 ORM
- PostgreSQL
- JWT access tokens + rotating refresh-token sessions
- AWS S3 storage (LocalStack in development)
- AWS Bedrock for AI document intelligence (provider-agnostic; mock provider in development)
- Docker

## Quick Start (Docker - Recommended)

Run the entire stack with Docker:

```bash
# Build and start all services
docker-compose up -d

# Run database migrations
docker-compose exec api npx prisma migrate deploy

# (Optional) Seed with sample data
docker-compose exec api npx prisma db seed
```

The API will be available at `http://localhost:3000`

### Stop/Restart

```bash
docker-compose down      # Stop all services
docker-compose up -d     # Start all services
docker-compose logs -f   # View logs
```

---

## Local Development (Without Docker)

### 1. Install Dependencies

```bash
npm install
```

### 2. Start PostgreSQL Only

```bash
# Start just the database
docker-compose up -d postgres
```

### 3. Setup Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Seed database with sample data
npm run prisma:seed
```

### 4. Start Development Server

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

## API

All routes are served under the global `/api` prefix (set in `src/main.ts`), so
`/auth/login` is actually `http://localhost:3000/api/auth/login`.

Authorization is **ownership / active-lease based**, enforced inside the service
layer — there are no user roles and no `@Roles` decorator. In the tables below,
"Owner" means `Property.ownerId == currentUser.id`; "Tenant" means the current
user holds an active `Lease` on the property. Every route except the auth
endpoints noted below requires a `Bearer <accessToken>` header (`JwtAuthGuard`).

### Health (`/api/health`)

`GET /api/health` — unauthenticated liveness probe returning `{ "status": "ok" }`.
Used by the container `HEALTHCHECK` and the AWS ALB target-group health check.
When deploying, point the ALB `health_check_path` at `/api/health`.

### Production image

`Dockerfile` is a multi-stage, non-root build that runs under `dumb-init`
(clean SIGTERM on ECS stops), sets `NODE_ENV=production`, includes a
`HEALTHCHECK` against `/api/health`, and reuses the Prisma client generated in
the build stage (pinned version, no runtime network fetch).

### Auth (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register a user; returns access + refresh tokens and creates a `Session` | Public |
| POST | `/auth/login` | Login; returns access + refresh tokens | Public |
| POST | `/auth/refresh` | Rotate the refresh token, issue a new access token | Public (valid refresh token) |
| POST | `/auth/logout` | Revoke the current session (by refresh token) | Public |
| POST | `/auth/logout-all` | Revoke all sessions for the user | Bearer |

Access tokens live 15 minutes; refresh tokens live 30 days and rotate on every
use. Refresh tokens are stored only as bcrypt hashes in the `Session` table. A
`x-device-identifier` header is recorded per session when present.

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Current user profile |
| GET | `/me/dashboard` | Aggregated dashboard (properties, leases, etc.) |
| POST | `/users/me/delete` | Delete account (requires current password) |

### Properties

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/properties` | List the current user's owned properties | Owner |
| POST | `/properties` | Create a property (owner = current user) | Any user |
| GET | `/properties/:id` | Get property details | Owner / Tenant |
| PATCH | `/properties/:id` | Update a property | Owner |
| DELETE | `/properties/:id` | Delete a property | Owner |

### Leases (tenant onboarding via activation codes)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/properties/:propertyId/leases` | List a property's leases | Owner |
| POST | `/properties/:propertyId/leases` | Create a (tenant-less) lease | Owner |
| POST | `/leases/:id/activation-code` | (Re)generate the lease activation code | Owner |
| POST | `/leases/redeem` | Redeem an activation code to join as tenant | Any user |
| GET | `/leases/my` | List the current user's leases (as tenant) | Tenant |
| GET | `/leases/:id` | Get lease details | Owner / Tenant |
| PATCH | `/leases/:id/status` | Update lease status (`PENDING`/`ACTIVE`/`ENDED`) | Owner |

### Documents

Documents attach to a **Property** or a **Lease**. Physical files live in a
separate `StoredFile` (see Storage & Media Architecture). Uploads support both a
direct multipart upload and a signed-URL flow. Access is governed by an
extensible `DocumentPermission` (`LANDLORD_ONLY | LANDLORD_AND_TENANT`, replacing
the old `PRIVATE/SHARED` visibility). Documents may be filed into per-property
**folders**, and every action is recorded in a `DocumentAuditLog`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/properties/:propertyId/documents` | List property documents |
| GET | `/leases/:leaseId/documents` | List lease documents |
| GET | `/documents/:id` | Get document details |
| PATCH | `/documents/:id` | Update document metadata (name, category, permission, folder) |
| DELETE | `/documents/:id` | Delete document record |
| DELETE | `/documents/:id/with-file` | Delete document + its stored file |
| POST | `/documents/bulk/delete` | Bulk delete documents (selection mode) |
| POST | `/documents/bulk/move` | Bulk move documents into a folder |
| POST | `/properties/:propertyId/documents/upload` | Direct multipart upload (property) |
| POST | `/leases/:leaseId/documents/upload` | Direct multipart upload (lease) |
| POST | `/properties/:propertyId/documents/upload-url` | Get a signed upload URL (property) |
| POST | `/leases/:leaseId/documents/upload-url` | Get a signed upload URL (lease) |
| GET | `/documents/:id/download-url` | Get a signed download URL (logs a DOWNLOAD audit event) |
| GET | `/documents/:id/preview-url` | Get a signed URL + mime type for in-app preview |
| POST | `/leases/:leaseId/documents/request` | Landlord requests a document (no file yet) |
| POST | `/documents/:id/fulfill` | Tenant uploads a file to fulfill a request |
| GET | `/properties/:propertyId/required-documents` | List required docs across a property's leases |

### Folders

Per-property document folder tree (nesting supported). Six system folders
(Contracts, Receipts, Property Plans, Insurance, Municipality, General) are
seeded on property creation and cannot be renamed, moved, or deleted.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/properties/:propertyId/folders` | Folder tree for a property | Owner / Tenant |
| POST | `/properties/:propertyId/folders` | Create a folder | Owner |
| PATCH | `/folders/:id` | Rename / re-parent a folder | Owner |
| DELETE | `/folders/:id` | Delete a (non-system) folder | Owner |

### Receipts

Receipts are first-class `RECEIPT` documents plus a `Receipt` metadata row
(`receiptDate`, `taxYear`, `source`, related lease/maintenance, notes), auto-
filed under `Receipts → <taxYear>`. Owner-only. Maintenance receipts flow
through the same pipeline (source `MAINTENANCE`); the file is never duplicated.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/properties/:propertyId/receipts/upload` | Manual receipt upload (multipart) |
| GET | `/properties/:propertyId/receipts` | List receipts (optional `?year=`) |
| GET | `/properties/:propertyId/receipts/summary` | Per-tax-year dashboard (count + total storage) |
| GET | `/properties/:propertyId/receipts/export.csv` | Export receipt metadata as CSV (optional `?year=`) |
| GET | `/properties/:propertyId/receipts/export.zip` | Export receipt files as a ZIP, foldered by year |

### AI (document intelligence)

Asynchronous, provider-agnostic analysis (summary, category suggestion,
normalized extracted fields). Uploads enqueue a background `AiJob`
(`QUEUED → PROCESSING → COMPLETED/FAILED`) — analysis never blocks upload. The
AI prediction (`AiClassification.predictedCategory`) never overwrites the
user's `approvedCategory`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/documents/:id/ai` | AI status, summary, prediction, approved category, extracted fields |
| POST | `/documents/:id/ai/retry` | Manually re-queue analysis |
| POST | `/documents/:id/ai/category` | Record the user's category decision (becomes official) |

### Property Media (gallery)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/properties/:propertyId/media` | List property photos/videos |
| POST | `/properties/:propertyId/media/upload` | Upload a photo/video (multipart) |
| DELETE | `/media/:id` | Delete a media item |

### Maintenance Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/properties/:propertyId/requests` | List a property's requests |
| POST | `/properties/:propertyId/requests` | Create a request |
| GET | `/me/requests` | List requests created by the current user |
| GET | `/requests/:id` | Get request details |
| PATCH | `/requests/:id` | Update a request (e.g. status) |
| DELETE | `/requests/:id` | Delete a request |
| GET | `/requests/:id/comments` | List comments (conversation) |
| POST | `/requests/:id/comments` | Add a comment |
| POST | `/requests/:id/read` | Mark the conversation read |
| GET | `/requests/:id/attachments` | List evidence attachments |
| POST | `/requests/:id/attachments/upload` | Upload an attachment (multipart) |
| DELETE | `/attachments/:attachmentId` | Delete an attachment |
| GET | `/requests/:id/receipts` | List financial receipts (resolved requests) |
| POST | `/requests/:id/receipts/upload` | Upload a receipt — a RECEIPT `Document` cross-linked to the request |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List the user's notifications |
| GET | `/notifications/unread-count` | `{ count }` of unread notifications |
| PATCH | `/notifications/:id/read` | Mark one notification read |
| PATCH | `/notifications/read-all` | Mark all read; returns `{ markedAsRead }` |

## Test Credentials (after seeding)

Seeded by `npm run prisma:seed`. Remember: there are no roles — "owner" and
"tenant" below are just two accounts, and either can own and rent.

**Owner:**
- Email: `owner@example.com`
- Password: `owner123`

**Tenant:**
- Email: `tenant@example.com`
- Password: `tenant123`

## Project Structure

```
src/
├── auth/                 # Auth: JWT access + DB-backed refresh sessions
│   ├── decorators/       # @CurrentUser
│   ├── dto/              # login / register / refresh DTOs
│   ├── guards/           # JwtAuthGuard, PropertyAccessGuard, PropertyOwnerGuard
│   ├── interfaces/       # JwtPayload, AuthResponse
│   └── strategies/       # Passport JWT strategy
├── users/                # Profile, dashboard, account deletion
├── properties/           # Property CRUD (owner-scoped, Google Places fields)
├── leases/               # Leases + tenant activation-code redemption
├── documents/            # Property & lease documents, folders, permissions, audit log
├── folders/              # Per-property document folder tree (+ system folders)
├── receipts/             # Receipt metadata, tax-year filing, CSV/ZIP export
├── ai/                   # AI platform: AIProvider abstraction, mock + Bedrock, async jobs
├── property-media/       # Property gallery photos/videos
├── maintenance/          # Requests, comments, read-tracking, attachments, receipts
├── notifications/        # In-app notifications
├── media/                # Shared StoredFile pipeline + media validation
├── storage/              # Storage abstraction (S3 provider, LocalStack/AWS)
├── prisma/               # PrismaService
├── app.module.ts         # Root module
└── main.ts               # Entry point (sets global /api prefix)
```

There is no `invitations` module — tenant onboarding lives in `leases`.

## Environment Variables

Copy `.env.example` to `.env` and configure (see the file for full docs):

```env
# Database
DATABASE_URL="postgresql://keynest:keynest_secret@localhost:5432/keynest?schema=public"

# Auth — signs access tokens. Token lifetimes (15m access / 30d refresh) are
# managed in code, so there is no TTL env variable.
JWT_SECRET="change-me"

# App
PORT=3000
NODE_ENV=development

# Storage (S3 / LocalStack) — see Storage & Media Architecture below
STORAGE_PROVIDER=s3
AWS_REGION=eu-central-1
AWS_ENDPOINT=http://localhost:4566   # LocalStack; leave empty for real AWS
S3_PUBLIC_ENDPOINT=                  # optional; LAN IP for physical-device testing
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_S3_BUCKET=keynest-local-documents
LEGAL_BUCKET=keynest-legal

# Google Maps / Places (property location autocomplete)
GOOGLE_MAPS_API_KEY=

# AI document intelligence. Provider-agnostic; business code talks only to the
# AIProvider abstraction. Defaults are safe for local dev (feature off; mock
# provider needs no AWS). Bedrock authenticates via the ECS task role in AWS.
AI_ENABLED=false                                       # enqueue background analysis on upload
AI_PROVIDER=mock                                       # mock | bedrock
AI_MODEL_ID=eu.anthropic.claude-haiku-4-5-20251001-v1:0 # Bedrock model / inference-profile id
AI_AWS_REGION=eu-central-1                             # falls back to AWS_REGION
```

## Development Commands

```bash
# Start development server
npm run start:dev

# Run database migrations
npm run prisma:migrate

# Open Prisma Studio
npm run prisma:studio

# Reset database
npm run db:reset

# Run tests
npm run test

# Build for production
npm run build
```

## Storage & Media Architecture

Every uploaded file in RentFlow — documents, property photos/videos, maintenance
attachments, and future lease/inspection/signature files — shares one media
platform. Business meaning is fully separated from physical storage.

```
Business entities  Document │ PropertyMedia │ MaintenanceAttachment │ (future: LeaseDocument, InspectionReport, Signature)
                       │  business fields only (category, permission, status, ownership) + storedFileId
                       ▼
Media layer        StoredFile (entity)  ←  StoredFileService  (the ONE upload/download/delete pipeline)
                       │  storage metadata only (storageKey, mimeType, size, checksum, dimensions, provider…)
                       ▼
Storage layer      StorageService          ← key-only facade (bucket, public URLs, signed URLs)
                       ▼
                   StorageProvider (interface)
                       ▼
                   S3StorageProvider        ← the ONLY place the AWS SDK is imported
                   (AWS S3 + LocalStack; future: CloudFrontStorageProvider)
```

### Business vs. storage split

- A **business entity** (e.g. `Document`) holds only business data — category,
  permission, status, ownership, workflow — plus a `storedFileId` FK. It has no
  `url`/`fileName`/`mimeType`/`size` columns.
- A **`StoredFile`** holds only physical-storage metadata and never knows *why*
  it exists. One business entity references one `StoredFile` today; supporting
  *multiple* files per entity later needs no `StoredFile` change (only a join on
  the owner side).
- **`StoredFileService`** (`src/media/`) is the single pipeline every domain
  reuses: `validate → uuid → build key → StorageService.uploadFile → persist
  StoredFile`. Storage keys are UUID-based and never contain the original
  filename, e.g. `properties/{id}/documents/{uuid}.pdf`,
  `maintenance/{id}/attachments/{uuid}.png`.
- API responses expose only business-safe fields (`originalFilename`,
  `mimeType`, `size`, a `url`, business metadata). `storageKey`, bucket and
  provider are never serialized.

- **`StorageService`** (`src/storage/storage.service.ts`) is the only class
  business code uses: `uploadFile`, `generateUploadUrl`, `generateDownloadUrl`,
  `downloadFile`, `deleteFile`, `fileExists`, `getObjectMetadata`,
  `getPublicUrl`, `extractKeyFromUrl`. Method/type names are generic
  (`StoredFile`, `DownloadedFile`), not document-specific.
- **`StorageProvider`** (`src/storage/interfaces`) is the backend contract. No
  SDK type crosses it.
- **`S3StorageProvider`** (`src/storage/providers`) is the only AWS SDK
  consumer. It normalizes all SDK errors into `StorageException` /
  `StorageObjectNotFoundException` (`src/storage/storage.exceptions.ts`).
- The provider is selected by the **`STORAGE_PROVIDER`** env var via a factory
  in `StorageModule`, so swapping backends is configuration-only.

### How LocalStack is used

LocalStack vs. real AWS is purely configuration — the same `S3StorageProvider`
serves both:

- Set `AWS_ENDPOINT=http://localhost:4566` → LocalStack (path-style URLs, test
  credentials). Leave it **empty** → real AWS.
- `S3_PUBLIC_ENDPOINT` (optional) is the host used when building file URLs
  returned to clients; set it to your machine's LAN IP for physical-device
  testing (a device can't reach the server's `localhost`). Defaults to
  `AWS_ENDPOINT`.

```bash
npm run localstack:start   # start LocalStack
npm run dev                # Postgres + LocalStack + API (watch mode)
```

### Switching to AWS (production)

Inject the variables from `.env.production` (e.g. via the ECS task definition):
set `AWS_ENDPOINT=` (empty), a real `AWS_REGION` and `AWS_S3_BUCKET`, and prefer
an **IAM task role** over static `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`.
No code changes are required.

### Future: CloudFront

`generateDownloadUrl()` already hides whether a URL is an S3 pre-signed URL or a
CloudFront signed URL. To add CDN delivery later: implement a
`CloudFrontStorageProvider` against the same `StorageProvider` interface, add a
`case 'cloudfront'` to the factory in `StorageModule`, and set
`STORAGE_PROVIDER=cloudfront` plus the (currently commented) `AWS_CLOUDFRONT_*`
variables. **No business module changes.**

### Environment files

- `.env.example` — canonical template (all variables, documented).
- `.env.development` — local/LocalStack reference values.
- `.env.production` — production (real AWS) reference; secrets injected, not committed.
- `.env` — the file the app loads for local dev (gitignored).
- `.env.local` — optional, gitignored per-machine overrides; takes precedence over `.env`.
