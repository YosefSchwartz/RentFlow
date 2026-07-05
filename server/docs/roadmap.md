# KeyNest Roadmap

> Status note: Phase 1 (MVP) is built, and several Phase 2/3 items already ship
> today — AWS S3 (via LocalStack in dev) storage, English + Hebrew (RTL), and
> in-app notifications. Note there is no "role management" line item: KeyNest
> intentionally has no user roles (capabilities derive from ownership + leases).

## Phase 1 - MVP (Foundation)

### Goal

Validate that landlords actually replace WhatsApp with KeyNest.

### Features

* User authentication
* Property creation
* Tenant invitation system
* Document upload & viewing
* Maintenance requests (basic)

### Output

* Working mobile app (Expo)
* Working backend (NestJS)
* PostgreSQL database
* Local file uploads

---

## Phase 2 - Productization

### Goal

Make the system usable by multiple landlords.

### Features

* AWS S3 file storage
* Improved UI/UX
* Tenant onboarding flow improvement (lease activation codes)
* Basic notifications (email)

---

## Phase 3 - Engagement Layer

### Goal

Increase daily usage.

### Features

* Push notifications
* Maintenance request updates
* Activity log per property
* Document versioning

---

## Phase 4 - Monetization

### Goal

Start charging.

### Features

* Subscription model for landlords
* Premium features:

  * More properties
  * Analytics
  * Export reports

---

## Phase 5 - Payments & Legal

### Goal

Expand to full property lifecycle management.

### Features

* Rent tracking
* Payment integration (Israeli PSPs)
* Digital signatures integration
* Lease lifecycle management

---

## Phase 6 - Platform Expansion

### Goal

Turn into full property OS.

### Features

* Web dashboard
* Accounting integrations
* Service providers marketplace
* AI insights for landlords

---

## Success Metric for MVP

* At least 1 landlord using it daily
* At least 10 properties managed in system
* Maintenance requests replacing WhatsApp conversations
