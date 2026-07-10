# Module: storage

**Status:** implemented (Layer 6 — Storage).

Secure private S3 bucket for application data — property images, user documents,
contracts, generated reports, and uploads. This is the production backing for
the backend's existing `S3StorageProvider` (LocalStack in dev). Consumes
Foundation (`name_prefix`, `common_tags`); defines no names/tags/regions of its
own. Creates **no IAM, public policy, or CloudFront**.

## Bucket naming

`<name_prefix>-<purpose>` → e.g. `rentflow-staging-storage`. (S3 names are
globally unique; `name_prefix` already includes project + environment. Set a
distinct `purpose` for additional buckets, or add an account-id suffix if a
global collision ever occurs.)

## Resources created

| Resource | Setting |
| --- | --- |
| `aws_s3_bucket` | private (default) |
| `aws_s3_bucket_public_access_block` | all 4 flags **true** |
| `aws_s3_bucket_ownership_controls` | `BucketOwnerEnforced` (ACLs disabled) |
| `aws_s3_bucket_versioning` | Enabled |
| `aws_s3_bucket_server_side_encryption_configuration` | SSE-S3 (AES256), or SSE-KMS if `kms_key_arn` |
| `aws_s3_bucket_policy` | Deny non-TLS (`aws:SecureTransport = false`) |
| `aws_s3_bucket_lifecycle_configuration` | abort incomplete MPU + expire non-current versions |
| `aws_s3_bucket_cors_configuration` | only if `cors_allowed_origins` set (no wildcard) |

## Lifecycle (cost-aware, data-safe)

- **Abort incomplete multipart uploads** after `abort_multipart_days` (7) — no paying for orphaned parts.
- **Expire non-current versions** after `noncurrent_version_expiration_days` (90).
- **Current (live) objects are never auto-deleted** — user data is retained until explicitly removed.

## Inputs

| Name | Default | Notes |
| --- | --- | --- |
| `name_prefix`, `tags` | — | from Foundation |
| `purpose` | `storage` | bucket suffix |
| `kms_key_arn` | `null` | null = SSE-S3 |
| `noncurrent_version_expiration_days` | `90` | |
| `abort_multipart_days` | `7` | |
| `force_destroy` | `false` | protects user data |
| `cors_allowed_origins` | `[]` | empty = no CORS rule; never `["*"]` unless justified |
| `cors_allowed_methods` / `_headers` / `cors_max_age_seconds` | GET/PUT/POST/HEAD · `*` · 3000 | used only when origins set |

## Outputs

`bucket_id`, `bucket_arn`, `bucket_name`, `bucket_regional_domain_name`.

## Consumed by (future)

- **backend** → `bucket_name` for the `S3StorageProvider`; a least-privilege app
  role (future `security`/compute layer) gets scoped access to `bucket_arn`.
- **presigned uploads** → backend issues presigned PUT/GET URLs; set
  `cors_allowed_origins` when a browser client needs direct upload.
