# RentFlow MVP

> **Note:** This is the original MVP vision/scope document. Some early
> assumptions have since evolved — the shipped system has **no user roles**
> (capabilities come from ownership + lease relationships), uses **Leases with
> activation codes** instead of a `TenantAssignment` entity, stores files via a
> `StoredFile` abstraction (not a `fileUrl` column), and already ships in-app
> notifications and Hebrew/RTL. For current behavior see
> [`api.md`](api.md), [`database.md`](database.md), and the
> [backend README](../README.md).

## Vision

RentFlow is a property management platform designed for small and medium landlords who manage between 2 and 20 rental properties.

The goal is to centralize property information, tenant communication, documents, and lease-related activities in a single platform instead of relying on WhatsApp, emails, and scattered files.

---

# MVP Goal

Allow landlords to:

* Manage properties
* Store property-related documents
* Invite tenants
* Give tenants access to their property information
* Receive maintenance requests

Allow tenants to:

* Access their rented property
* View shared documents
* Submit maintenance requests

---

# Capabilities

> These are **capabilities / experiences**, not account roles. There is no
> `role` field — the same account can be both a landlord and a tenant.
> Capabilities are derived from property ownership and active leases.

## Landlord (property owner)

Property owner or property manager.

Permissions:

* Create properties
* Edit properties
* Upload documents
* Invite tenants
* Manage maintenance requests

---

## Tenant

A renter associated with a property.

Permissions:

* View assigned property
* View shared documents
* Create maintenance requests

---

# Core Entities

## User

Represents any account (may be both landlord and tenant).

Fields:

* id
* email
* firstName
* lastName
* createdAt

(No `role` field — see Capabilities above.)

---

## Property

Represents a rental property.

Fields:

* id
* ownerId
* title
* address
* city
* squareMeters
* rooms
* floor
* hasBalcony
* hasParking
* hasStorage
* notes
* createdAt

---

## Lease

Links a tenant to a property (and is the tenant-onboarding mechanism). Replaces
the originally-planned `TenantAssignment`.

Fields:

* id
* propertyId
* tenantId (nullable until the activation code is redeemed)
* activationCode (+ activationCodeExpiresAt)
* status
* startDate, endDate, monthlyRent, depositAmount

Status:

* PENDING
* ACTIVE
* ENDED

---

## Document

Represents a file uploaded to a property.

Fields:

* id
* propertyId (or leaseId)
* uploadedBy
* name
* category
* visibility (PRIVATE | SHARED)
* status (OPTIONAL | REQUESTED | RECEIVED)
* storedFileId (physical file lives in StoredFile)
* createdAt

Categories:

* lease
* insurance
* warranty
* meter_reading
* other

---

## MaintenanceRequest

Represents an issue reported by a tenant.

Fields:

* id
* propertyId
* createdBy
* title
* description
* status
* createdAt

Status:

* open
* in_progress
* resolved

---

# User Flows

## Landlord Registration

1. Open app
2. Register account
3. Login
4. Enter dashboard

---

## Create Property

1. Click "Add Property"
2. Fill property details
3. Save property
4. Property appears in dashboard

---

## Upload Document

1. Open property
2. Go to documents
3. Upload file
4. Select category
5. Save

---

## Invite Tenant

1. Open property
2. Click "Invite Tenant"
3. Generate invitation code
4. Share code with tenant

---

## Tenant Registration

1. Open app
2. Register account
3. Login
4. Enter invitation code
5. Property becomes available

---

## Create Maintenance Request

1. Open property
2. Click "Report Issue"
3. Enter title
4. Enter description
5. Attach image (optional)
6. Submit request

---

# MVP Screens

## Authentication

### Login

Fields:

* Email
* Password

Actions:

* Login
* Go to Register

---

### Register

Fields:

* First Name
* Last Name
* Email
* Password

Actions:

* Register

---

## Landlord Screens

### Dashboard

Displays:

* Properties List
* Add Property Button

---

### Property Details

Displays:

* Property Information
* Documents
* Tenant Information
* Maintenance Requests

---

### Add Property

Fields:

* Title
* Address
* City
* Square Meters
* Rooms
* Floor
* Balcony
* Parking
* Storage
* Notes

---

### Documents

Displays:

* Uploaded Documents
* Upload Button

---

### Maintenance Requests

Displays:

* Open Requests
* In Progress Requests
* Resolved Requests

Actions:

* Update Status

---

## Tenant Screens

### My Property

Displays:

* Property Information
* Shared Documents
* Active Requests

---

### Documents

Displays:

* All Shared Documents

---

### Maintenance Requests

Displays:

* Existing Requests

Actions:

* Create Request

---

# Non-Functional Requirements

## Mobile

* Hebrew support
* RTL support
* Android first
* iOS support

---

## Security

* Authentication required (JWT access + rotating refresh tokens)
* Ownership / active-lease authorization (no roles), enforced in the backend
* Secure document access

---

## Storage

* Property images
* PDF documents
* Maintenance request images

---

# Technical Stack

## Mobile

* React Native
* Expo
* TypeScript

## Backend

* NestJS
* Prisma
* PostgreSQL

## Storage

* Local filesystem (development)
* AWS S3 (production)

## Authentication

* JWT (development)
* AWS Cognito (future)

---

# Out of Scope (Future Versions)

* Online rent payments
* Utility bill payments
* Digital signatures
* Push notifications (in-app notifications already ship; push is future)
* Real-time chat
* AI features
* Web application

Already shipped since the original MVP scope: English + Hebrew (RTL)
localization, in-app notifications, and AWS S3 / LocalStack file storage.

---

# Success Criteria

The MVP is successful when:

* A landlord can manage properties
* Documents are organized per property
* A tenant can access their property information
* Maintenance requests replace WhatsApp messages
* Real users actively use the platform
