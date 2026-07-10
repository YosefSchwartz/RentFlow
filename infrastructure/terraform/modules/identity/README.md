# Module: identity

**Status:** implemented (Layer 5 — Identity). Amazon Cognito.

Managed authentication for the iOS/Android apps and, via OIDC, future backend
services. Consumes Foundation (`name_prefix`, `common_tags`); defines no names,
tags, or regions of its own. Creates **no IAM users, app credentials, or backend
permissions**.

> This module provisions the identity **infrastructure**. Wiring the mobile app
> and backend to Cognito is a separate application migration — the backend today
> still uses its own JWT + DB-backed sessions (see `../../../../CLAUDE.md`).

## Resources created (2)

| Resource | Notes |
| --- | --- |
| `aws_cognito_user_pool` | Email sign-in, strong password, MFA, threat protection. |
| `aws_cognito_user_pool_client` | Public mobile client (no secret), SRP + refresh. |

**No Cognito groups** — RentFlow users have no roles (authorization derives from
ownership + active lease). Groups would model roles the domain does not have.
**No hosted-UI domain** — apps use SRP directly; the pool is still an OIDC issuer.

## Security posture (secure defaults)

| Control | Setting |
| --- | --- |
| Sign-in | email as username, case-insensitive |
| Email verification | enabled (`auto_verified_attributes`) |
| Password | ≥12 chars, upper+lower+number+symbol |
| Account recovery | verified email only (no SMS) |
| MFA | `OPTIONAL` TOTP (software token; no SMS) |
| Threat protection | `AUDIT` (→ `ENFORCED` recommended for production) |
| User enumeration | `prevent_user_existence_errors = ENABLED` |
| Token revocation | enabled (supports logout / global sign-out) |
| Deletion protection | `ACTIVE` |
| Auth flow | SRP only (no plaintext `USER_PASSWORD_AUTH`) |

## Inputs

| Name | Default |
| --- | --- |
| `name_prefix`, `tags` | from Foundation |
| `password_min_length` | `12` |
| `mfa_configuration` | `OPTIONAL` |
| `advanced_security_mode` | `AUDIT` |
| `access_token_validity_minutes` | `15` |
| `id_token_validity_minutes` | `15` |
| `refresh_token_validity_days` | `30` |
| `deletion_protection` | `true` |

## Outputs

`user_pool_id`, `user_pool_arn`, `user_pool_client_id`, `user_pool_endpoint`,
`issuer_url`, `discovery_endpoint`.

## Consumed by (future)

- **mobile app** → `user_pool_id` + `user_pool_client_id` (Amplify / Cognito SDK).
- **backend middleware** → `issuer_url` / `discovery_endpoint` (validate JWTs via JWKS).

## Future security compatibility

- `advanced_security_mode = ENFORCED` for production; export threat-protection
  events to the Security layer's CloudWatch.
- Optional custom KMS + SES for verification emails.
- Optional Lambda triggers (pre-signup domain checks, custom claims) — none now.
