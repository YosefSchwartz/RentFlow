# RentFlow API Design

> Design notes for the REST API. For the full, authoritative endpoint list see
> the [backend README](../README.md#api). This document highlights the shape and
> conventions rather than repeating every route.

## Base URL

All routes are served under the global prefix:

```
/api
```

## Conventions

- REST + JSON. Validation via `class-validator` DTOs (global `ValidationPipe`
  with `whitelist` + `forbidNonWhitelisted`).
- **No roles.** Authorization is ownership / active-lease based and is enforced
  inside the service layer, not by a role decorator. "Owner" =
  `Property.ownerId == currentUser.id`; "Tenant" = the user holds an active
  `Lease` on the property.
- Every route requires `Authorization: Bearer <accessToken>` (`JwtAuthGuard`),
  except the public auth endpoints noted below.

---

# Authentication

Access tokens live 15 minutes; refresh tokens live 30 days and rotate on every
use. Refresh tokens are stored only as bcrypt hashes in the `Session` table.

## POST /auth/register

Create a user. Returns access + refresh tokens and opens a session.

```json
// Request
{ "email": "string", "password": "string", "firstName": "string", "lastName": "string" }
// Response
{ "accessToken": "jwt", "refreshToken": "opaque", "user": { "id": "...", "email": "..." } }
```

> There is **no** `role` field — do not send one.

## POST /auth/login

```json
// Request
{ "email": "string", "password": "string" }
// Response
{ "accessToken": "jwt", "refreshToken": "opaque", "user": { ... } }
```

## POST /auth/refresh

Rotate the refresh token and issue a fresh access token.

```json
// Request
{ "refreshToken": "opaque" }
// Response
{ "accessToken": "jwt", "refreshToken": "opaque" }
```

## POST /auth/logout · POST /auth/logout-all

Revoke the current session (by refresh token) or all of the user's sessions.

---

# Properties

- `GET /properties` — list the current user's owned properties.
- `POST /properties` — create a property (owner = current user).
- `GET /properties/:id` — details (owner or active-lease tenant).
- `PATCH /properties/:id` — update (owner).
- `DELETE /properties/:id` — delete (owner).

Properties carry Google Places location fields (`formattedAddress`, `street`,
`streetNumber`, `latitude`, `longitude`, `placeId`) alongside the manual
`address`/`city`.

---

# Leases & Tenant Onboarding

There is no invitation/`TenantAssignment` entity. Onboarding is lease-based:

1. `POST /properties/:propertyId/leases` — landlord creates a tenant-less lease.
2. `POST /leases/:id/activation-code` — (re)generate the lease's activation code.
3. `POST /leases/redeem` — a tenant redeems the code to become the lease tenant.

Other lease routes:

- `GET /leases/my` — the current user's leases (as tenant).
- `GET /properties/:propertyId/leases` — a property's leases (owner).
- `GET /leases/:id` — lease details.
- `PATCH /leases/:id/status` — set `PENDING | ACTIVE | ENDED`.

---

# Documents

Documents attach to a **Property** or a **Lease**. The physical file lives in a
separate `StoredFile`; the document row carries only business metadata
(`category`, `visibility`, `status`).

- Direct upload: `POST /properties/:propertyId/documents/upload`,
  `POST /leases/:leaseId/documents/upload` (multipart `file`).
- Signed-URL flow: `POST .../documents/upload-url`, then
  `GET /documents/:id/download-url`.
- Required-document workflow: `POST /leases/:leaseId/documents/request` (landlord
  requests) → `POST /documents/:id/fulfill` (tenant uploads). Status transitions
  `OPTIONAL → REQUESTED → RECEIVED`.
- `GET /properties/:propertyId/required-documents`.
- Read/update/delete: `GET|PATCH|DELETE /documents/:id`,
  `DELETE /documents/:id/with-file`.

---

# Property Media

- `GET /properties/:propertyId/media`
- `POST /properties/:propertyId/media/upload` (multipart image/video)
- `DELETE /media/:id`

---

# Maintenance Requests

- `POST /properties/:propertyId/requests` — create.
- `GET /properties/:propertyId/requests`, `GET /me/requests`, `GET /requests/:id`.
- `PATCH /requests/:id` (e.g. status `OPEN | IN_PROGRESS | RESOLVED`),
  `DELETE /requests/:id`.
- Conversation: `GET|POST /requests/:id/comments`, `POST /requests/:id/read`.
- Attachments: `GET /requests/:id/attachments`,
  `POST /requests/:id/attachments/upload`, `DELETE /attachments/:attachmentId`.

---

# Notifications

- `GET /notifications` — list.
- `GET /notifications/unread-count` — `{ count }`.
- `PATCH /notifications/:id/read`.
- `PATCH /notifications/read-all` — `{ markedAsRead }`.

State changes across the app (lease redeemed/approved/rejected, maintenance
created/updated/resolved/commented, document uploaded/requested) create
notifications for the other party.

---

# Notes

- All endpoints require authentication (JWT Bearer) except register / login /
  refresh / logout.
- Authorization is ownership/lease-based — **never** role-based.
