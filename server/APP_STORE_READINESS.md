# RentFlow — Production & App Store Readiness

_Last updated: June 2026. This is a living checklist produced during the production-readiness INIT pass._

---

## 1. System status summary

| Area | Status | Notes |
|------|--------|-------|
| Auth & sessions | ✅ Aligned | 15-min access JWT + 30-day **rotating** refresh tokens (DB-backed `Session`), `bcrypt`-hashed. `logout` (single) + `logout-all` (multi-device) + `deviceIdentifier`. Mobile persists via SecureStore + 401-refresh interceptor → no re-login on reload. |
| Storage abstraction | ✅ Aligned | `StorageService` (key-only) → `StorageProvider` → `S3StorageProvider`. AWS SDK isolated to the provider (verified). LocalStack vs AWS is config-only (`AWS_ENDPOINT`). |
| Media / StoredFile | ✅ Unified | All uploads (documents, photos, videos, maintenance attachments) flow through one `StoredFileService` pipeline → `StoredFile` entity. Business entities hold only a `storedFileId`. UUID storage keys; DTOs never expose `storageKey`/bucket. |
| Documents + visibility | ✅ Aligned | `PRIVATE`/`SHARED` enforced (tenants see SHARED only); required-documents workflow (REQUEST → RECEIVED) end-to-end. |
| Leases (landlord-owned) | ✅ Aligned | Tenant-less leases + per-lease activation codes; tenant redeems to connect. Old `Invitation`/`TenantAssignment` onboarding removed. |
| Notifications | ✅ Aligned | Maintenance + document + lease events; mark-read on view; "recently active" comment suppression. |
| Tenant/Landlord flows | ✅ Consistent | Permissions by ownership + active lease (no role field), consistent backend↔mobile. |
| i18n / RTL | ✅ | English + Hebrew, translation-key-only, RTL-aware. |
| Legal pages | ✅ Created | Bilingual static privacy / terms / support, deployable to LocalStack S3 hosting. |

**Fixed during this pass:** mobile `.env.example` used wrong variable names (`API_BASE_URL` → corrected to `EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`); removed dead `JWT_EXPIRES_IN` from env templates (token TTLs are code-managed); added `LEGAL_BUCKET` to env templates.

---

## 2. Legal pages — local (LocalStack) endpoints

Deploy: `npm run legal:deploy` (LocalStack must be running: `npm run localstack:start`).

| Page | Local URL |
|------|-----------|
| Privacy Policy | http://localhost:4566/keynest-legal/privacy-policy |
| Terms of Service | http://localhost:4566/keynest-legal/terms-of-service |
| Support | http://localhost:4566/keynest-legal/support |
| Index | http://localhost:4566/keynest-legal/index.html |

Source: `legal/*.html` (bilingual EN/HE, responsive, RTL-aware). In production these go to an S3 bucket fronted by CloudFront/HTTPS at e.g. `https://keynest.app/privacy-policy`.

---

## 3. Apple App Store checklist

### Required before submission
- [ ] **Apple Developer Program** membership (USD 99/yr).
- [ ] **Bundle ID** registered (`com.keynest.app` — already in `app.json`).
- [ ] **App name**, subtitle, **description**, keywords, category (Lifestyle / Utilities).
- [ ] **Privacy Policy URL** (public HTTPS) — pages ready, host them.
- [ ] **Support URL** (public HTTPS) — `support` page ready.
- [ ] **Screenshots**: 6.7" (iPhone) required; 6.5"/5.5" as needed; iPad if supported (currently `supportsTablet: false`).
- [ ] **App icon** 1024×1024 (no alpha) — verify `./assets/icon.png`.
- [ ] **App privacy “nutrition label”** (App Store Connect): see Data Collection below.
- [ ] **Demo account** for review (landlord + tenant) + reviewer notes on the activation-code flow.
- [ ] **Export compliance**: uses standard HTTPS encryption → set `ITSAppUsesNonExemptEncryption=false` in `app.json` `ios.infoPlist` (add it).

### Permissions (usage strings — already set via `expo-image-picker` plugin)
- [x] Camera — "take property photos / record videos / maintenance evidence".
- [x] Photo library — "choose photos/videos to upload".
- [x] Microphone — "record video".
- [ ] Confirm **no location** permission is requested (address autocomplete uses Google Places text API, not GPS).

### Apple-specific gates
- [x] **In-app account deletion** (Guideline 5.1.1(v)): implemented. Profile → Settings → Account → **Delete Account** (warning → password re-auth → `POST /users/me/delete`). Permanently removes the user, cascades their owned properties/leases/maintenance, detaches them from leases as a tenant (history preserved for the landlord), deletes all `StoredFile` rows + S3 objects (no orphans), and invalidates all sessions.
- [x] **Sign in with Apple**: not required (no third-party/social login; email+password only).
- [ ] Confirm no private APIs, valid `NSAppTransportSecurity` (use HTTPS API in prod).

---

## 4. Google Play Store checklist

### Required before submission
- [ ] **Google Play Developer** account (USD 25 one-time).
- [ ] **Package name** (`com.keynest.app` — already in `app.json`).
- [ ] Store listing: title, short + full description, **feature graphic** (1024×500), icon (512×512), phone screenshots.
- [ ] **Privacy Policy URL** (public HTTPS) — required.
- [ ] **App signing**: enroll in **Play App Signing** (Google manages the signing key; upload key via EAS).
- [ ] **Content rating** questionnaire (no objectionable content → likely Everyone).
- [ ] **Target API level**: ensure Expo SDK 54 build targets the current required Android API.

### Data safety section (must match the privacy policy)
- [ ] Data collected: **Personal** (name, email), **Photos/Videos** (user-uploaded), **Files/Docs** (user-uploaded), **App activity** (minimal).
- [ ] Purpose: **App functionality** only. **Not** shared with third parties for ads; **not** sold.
- [ ] Data **encrypted in transit**: yes.
- [ ] Users can **request deletion**: yes — provide the deletion method/URL (see in-app deletion gap above).

### Permissions justification
- [ ] CAMERA — capture property photos & maintenance evidence.
- [ ] READ_MEDIA_IMAGES / READ_MEDIA_VIDEO — select media to upload.
- [ ] RECORD_AUDIO — video recording (if enabled).
- [ ] INTERNET — API/storage access.

---

## 5. Data collection reference (for both stores' privacy forms)

| Data | Collected | Linked to user | Purpose | Shared / Sold |
|------|-----------|----------------|---------|---------------|
| Name, email | Yes | Yes | Account, app functionality | No / No |
| Password | Yes (hashed) | Yes | Auth | No / No |
| Property & lease data | Yes | Yes | Core functionality | Landlord↔tenant only |
| Uploaded documents/photos/videos | Yes | Yes | Core functionality | Landlord↔tenant only |
| Maintenance requests | Yes | Yes | Core functionality | Landlord↔tenant only |
| Precise location | **No** | — | — | — |
| Analytics / ads identifiers | **No** | — | — | — |

---

## 6. What's ready vs missing

**Ready:** backend architecture (storage/media/documents/leases/notifications/sessions), bilingual legal+support pages, LocalStack hosting simulation, env templates, app icons/bundle IDs, media permission strings.

**Missing / to do before submission:**
1. ✅ ~~In-app account deletion~~ — **done** (Profile → Settings → Account → Delete Account).
2. **Public HTTPS hosting** of the legal/support pages (S3+CloudFront or any static host).
3. **Production backend** (RDS + ECS/Fargate + real S3) and a real `EXPO_PUBLIC_API_URL` (HTTPS).
4. **Store assets**: screenshots, feature graphic, final descriptions, reviewer demo accounts.
5. **EAS Build** config + production credentials/signing (replace placeholder `eas.projectId` in `app.json`).
6. Set `ITSAppUsesNonExemptEncryption=false` in `app.json`.

---

## 7. Next steps recommendation (pre-deployment)

1. **Account deletion** endpoint + Profile UI (unblocks Apple review).
2. Provision **AWS**: RDS Postgres, S3 bucket (`keynest-production`), ECS/Fargate service, Secrets Manager for `JWT_SECRET`/`DATABASE_URL`; use an **IAM task role** (no static keys).
3. Run migrations with `prisma migrate deploy` against RDS. (Note: the repo's migration history needs repair so `migrate dev`/shadow DB works — see backend notes.)
4. Host legal pages at stable HTTPS URLs; put the URLs in both store listings and in the app (Settings → Legal links).
5. Configure **EAS Build** + Play App Signing + Apple distribution certs; build production binaries.
6. Harden: rate-limit auth endpoints; optimize refresh-token lookup (currently scans sessions — index/lookup by token id at scale); add a scheduled `cleanupExpiredSessions`.
7. QA the full tenant↔landlord flow on physical devices (LAN IP for `EXPO_PUBLIC_API_URL` + `S3_PUBLIC_ENDPOINT`).
