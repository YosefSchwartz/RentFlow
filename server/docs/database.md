# RentFlow Database Design

PostgreSQL, implemented with Prisma. The authoritative schema is
[`prisma/schema.prisma`](../prisma/schema.prisma) — this document summarizes it.
IDs are `cuid()` strings; models have `createdAt`/`updatedAt` unless noted.

---

# Core Models

## User

Represents any account. **There is no `role` field** — a single user can both
own properties and rent them. Capabilities come from ownership and lease
relationships.

* id, email (unique), password (bcrypt hash), firstName, lastName
* Relations: ownedProperties, leases, maintenanceRequests, maintenanceComments,
  maintenanceReads, uploadedDocuments, sessions, notifications, uploaded media.

## Session

Backs refresh-token authentication (15m access tokens, 30d rotating refresh
tokens).

* id, refreshTokenHash (bcrypt), deviceIdentifier?, lastUsedAt, expiresAt
* userId → User (cascade delete)

## Property

A rental property owned by a user.

* id, ownerId → User
* title, address (legacy), city, squareMeters, rooms, floor?
* hasBalcony, hasParking, hasStorage, hasShelter (booleans), notes?
* Google Places: formattedAddress?, street?, streetNumber?, latitude?,
  longitude?, placeId?
* Relations: leases, documents, maintenanceRequests, media

## Lease

The relationship between a Property and a Tenant, and the tenant-onboarding
mechanism. **Replaces the old `TenantAssignment` concept.**

* id, propertyId → Property, tenantId? → User (nullable until redeemed)
* status: `PENDING | ACTIVE | ENDED` (default `PENDING`)
* startDate, endDate?, depositAmount? (Decimal), notes?
* monthlyRent? (Decimal) — **legacy**: a mirror of the first LeaseTerm kept for
  backward compatibility; pricing lives in LeaseTerm and is read through
  `LeasePricingService`.
* activationCode? (unique), activationCodeExpiresAt? — landlord shares the code;
  a tenant redeems it to join. Cleared once consumed.

## LeaseTerm

One pricing period of a lease's rent schedule. Periods are contiguous,
non-overlapping, and together cover the entire lease duration (enforced in
`LeasePricingService`). Designed to later carry per-period charges (parking,
storage, internet, municipal tax, …), discounts, CPI linkage and a pricing
type without a redesign.

* id, leaseId → Lease (cascade delete)
* startDate, endDate? — endDate is null only on the last period of an
  open-ended lease
* monthlyRent (Decimal), currency (ISO 4217, default `ILS`), notes?
* displayOrder — unique per lease (`@@unique([leaseId, displayOrder])`)
* Indexes: `[leaseId]`, `[leaseId, startDate]`

## Document

A file attached to a Property **or** a Lease. Holds only business metadata; the
physical bytes live in `StoredFile`.

* id, name, category (`DocumentCategory`)
* visibility: `PRIVATE | SHARED` (default `PRIVATE`)
* status: `OPTIONAL | REQUESTED | RECEIVED` (required-document workflow)
* requestedAt?, receivedAt?
* propertyId? / leaseId? (exactly one set), uploadedById? → User
* storedFileId? → StoredFile (null for a REQUESTED doc with no upload yet)

`DocumentCategory` includes property categories (INSURANCE, WARRANTY,
METER_READING, PROPERTY_PHOTO, INVOICE, MANUAL, PROPERTY_INFO, LEGAL,
IDENTIFICATION), lease categories (LEASE_AGREEMENT, SIGNED_LEASE,
GUARANTOR_DOCUMENT, ADDENDUM, TENANT_DOCUMENT), and CONTRACT/OTHER.

## MaintenanceRequest

An issue reported on a property.

* id, propertyId → Property, requesterId → User
* title, description, status (`OPEN | IN_PROGRESS | RESOLVED`), priority,
  resolvedAt?
* Relations: comments, attachments, reads

### MaintenanceComment

Conversation on a request: id, body, requestId → MaintenanceRequest,
authorId → User.

### MaintenanceRead

Tracks when a user last opened a request's conversation (for read state /
notification suppression): requestId + userId (unique together), lastReadAt.

## PropertyMedia / MaintenanceAttachment

Two distinct media domains, each referencing a `StoredFile`:

* **PropertyMedia** — property gallery photos/videos (type: IMAGE | VIDEO).
* **MaintenanceAttachment** — evidence files on a maintenance request.

## StoredFile (media/storage layer)

Physical-storage metadata only; no business meaning. Business entities
(`Document`, `PropertyMedia`, `MaintenanceAttachment`, and future
lease/inspection/signature files) reference it via `storedFileId`.

* id, storageKey (unique; UUID-based, never the original filename)
* originalFilename, mimeType, fileExtension?, fileSize, checksum?
* imageWidth?, imageHeight?, videoDuration?
* storageProvider (default `s3`), storageVersion?
* uploadedById? → User

## Notification

In-app notification.

* id, userId → User, type (`NotificationType`), title, message
* isRead, entityType?, entityId? (link back to the related entity)

`NotificationType`: LEASE_PENDING, LEASE_APPROVED, LEASE_REJECTED,
MAINTENANCE_CREATED, MAINTENANCE_UPDATED, MAINTENANCE_RESOLVED,
MAINTENANCE_COMMENT, DOCUMENT_UPLOADED, DOCUMENT_REQUESTED.

---

# Relationships

* User (1) → (N) Property (as owner)
* User (1) → (N) Lease (as tenant, nullable)
* Property (1) → (N) Lease
* Property / Lease (1) → (N) Document
* Property (1) → (N) MaintenanceRequest → (N) MaintenanceComment / Attachment
* User (1) → (N) Session, Notification
* Document / PropertyMedia / MaintenanceAttachment (1) → (1) StoredFile

---

# Notes

* Tenant onboarding uses per-lease activation codes, not a separate assignment
  table.
* Files are stored via the storage abstraction (S3 in production, LocalStack in
  development) and referenced through `StoredFile`.
* Migrations live in `prisma/migrations/`; never rely on `prisma db push` for
  production changes.
