# RentFlow Mobile

Expo / React Native client for RentFlow — a property management platform for
small and medium landlords (2–20 properties). The backend REST API lives in
[`../keynest`](../keynest).

## Tech Stack

- Expo (SDK 54) + React Native 0.81 (TypeScript)
- React Navigation v7 (native-stack + bottom-tabs)
- React Query v5 (`@tanstack/react-query`) for server state
- Axios (with automatic token-refresh interceptor)
- React Native Paper (Material Design 3) for UI
- i18next / react-i18next — English + Hebrew with full RTL
- expo-secure-store for token storage

## Prerequisites

- Node.js 18+
- The RentFlow backend running and reachable (see `../keynest`)
- Expo Go on a device, or an iOS Simulator / Android Emulator

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# then edit .env (see Environment Variables below)

# 3. Start the dev server
npm start
# or target a platform directly:
npm run android
npm run ios
```

## Environment Variables

Only `EXPO_PUBLIC_*` variables are exposed to the app at runtime. Copy
`.env.example` to `.env`:

```env
# Backend API base URL — MUST include the /api prefix.
#   iOS simulator / web : http://localhost:3000/api
#   Physical device     : http://<your-LAN-IP>:3000/api   (e.g. 192.168.1.10)
#   Production          : https://api.keynest.app/api
EXPO_PUBLIC_API_URL=http://localhost:3000/api

# Google Places API key (address autocomplete when creating a property)
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=
```

> A physical device cannot reach the backend's `localhost`. Use your computer's
> LAN IP in both `EXPO_PUBLIC_API_URL` here and the backend's `S3_PUBLIC_ENDPOINT`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the Expo dev server |
| `npm run android` | Start and open on Android |
| `npm run ios` | Start and open on iOS |
| `npm run prebuild` | Generate native projects (`expo prebuild`) |
| `npm run lint` | ESLint over `.ts`/`.tsx` |
| `npm run type-check` | `tsc --noEmit` |

## Architecture

There are **no account roles**. A single account can both own properties and
rent them. After login the user picks an **experience** — *Properties*
(landlord) or *Rentals* (tenant) — but both tab stacks are always available.

### Navigation

```
RootNavigator (native-stack)
├── Auth (when logged out)            → Login, Register
└── (when logged in)
    ├── ExperienceSelection           → choose Properties vs Rentals
    ├── Main (bottom tabs)
    │   ├── Properties  (landlord)    → property list, details, leases, photos,
    │   │                                documents, maintenance, create/edit,
    │   │                                lease activation code, create lease
    │   ├── Rentals     (tenant)      → my rentals, join property (redeem code),
    │   │                                tenant home, lease details, documents,
    │   │                                gallery, maintenance, report issue
    │   └── Profile                   → profile, settings, notifications
    │                                    (tab badge shows unread count)
    ├── Notifications
    └── Settings
```

### Project Structure

```
src/
├── api/            # Axios client + one typed module per backend domain
│   ├── client.ts   # apiClient: base URL from env, auth + 401-refresh interceptors
│   ├── auth.ts  properties.ts  leases.ts  documents.ts
│   ├── maintenance.ts  notifications.ts  propertyMedia.ts
│   └── user.ts  googlePlaces.ts (new Google Places API, via fetch)
├── hooks/          # React Query hooks wrapping the api modules
├── navigation/     # RootNavigator, AuthNavigator, MainNavigator
├── screens/        # auth/ · landlord/ · tenant/ · shared/ + ExperienceSelection
├── components/     # loading/empty/error, address autocomplete, media/ gallery…
├── store/          # AuthContext, LanguageContext
├── services/       # auth.ts — SecureStore token/user persistence
├── localization/   # i18n.ts + en.json, he.json
├── lib/            # queryClient, file helpers
├── utils/          # formatting/validation, rtl helpers, notification routing
└── types/          # domain types + navigation param lists
```

Path alias `@/*` → `./src/*` (see `tsconfig.json`).

### Authentication

- Tokens are stored with **expo-secure-store** (`keynest_access_token`,
  `keynest_refresh_token`, `keynest_user`).
- The Axios request interceptor attaches `Authorization: Bearer <accessToken>`.
- The response interceptor auto-refreshes on **401**: it calls
  `POST /auth/refresh` with the refresh token, queues concurrent requests while
  refreshing, retries the original request, and clears tokens (logging the user
  out) if refresh fails.
- `AuthContext` (`useAuth()`) exposes `user, isLoading, isAuthenticated, login,
  register, logout, logoutAll`. On launch it refreshes the session and re-fetches
  the current user.

### Data fetching

React Query is the single source of server state (no Redux). The shared
`QueryClient` (`src/lib/queryClient.ts`) uses `staleTime: 5 min`, `retry: 2`.
Hooks in `src/hooks/` wrap each API module and invalidate the relevant queries
on mutation so the UI stays fresh.

### Localization & RTL

- English and Hebrew, via i18next; all UI text uses translation keys
  (`t('...')`) — no hardcoded strings. Translations live in
  `src/localization/en.json` and `he.json`.
- Initial language comes from the device locale; the choice is persisted in
  SecureStore.
- Hebrew is RTL. Because React Native applies RTL at the native layer, switching
  direction requires an app reload: changing the language toggles `I18nManager`
  and prompts a restart (`expo-updates`). On startup, if the stored language and
  `I18nManager.isRTL` disagree, an `RTLMismatchScreen` prompts a reload.

## Related

- Backend API & data model: [`../keynest/README.md`](../keynest/README.md)
- Product/domain rules: [`../CLAUDE.md`](../CLAUDE.md)
