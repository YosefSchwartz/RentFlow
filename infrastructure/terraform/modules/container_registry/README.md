# Module: container_registry

**Status:** implemented (Layer 10 — Container Registry). Amazon ECR.

Private ECR repository for the RentFlow backend image. Consumes Foundation
(`name_prefix`, `common_tags`); defines no names/tags of its own. Creates **no
IAM users, access keys, or static credentials**.

## Resources created (2)

| Resource | Notes |
| --- | --- |
| `aws_ecr_repository` | private, `scan_on_push`, `IMMUTABLE` tags, encrypted |
| `aws_ecr_lifecycle_policy` | expire untagged (Nd) + keep last N images |

Repository name: `<name_prefix>-<repository_suffix>` → `rentflow-staging-backend`.

## Security posture

- **Private** — a standard ECR repository is account-private; no public access.
- **`scan_on_push = true`** — vulnerability scan on every push.
- **`IMMUTABLE` tags** — a tag can't be overwritten, so a deployed digest is
  reproducible and can't be silently replaced.
- **Encrypted at rest** — AES256 by default; optional customer-managed KMS via
  `kms_key_arn`.
- **No credentials** — same-account pulls use the ECS execution role (Layer 8)
  reaching ECR through the VPC endpoints (Layer 9). CI/CD pushes via OIDC
  (future), scoped to this repository ARN — never static keys.

## Lifecycle (cost-aware)

| Rule | Default |
| --- | --- |
| Expire untagged images older than | `untagged_expire_days` = 14 days |
| Keep only the most recent | `max_image_count` = 10 images |

Bounds storage cost without deleting the images you actually run.

## Inputs

| Name | Default |
| --- | --- |
| `name_prefix`, `tags` | from Foundation |
| `repository_suffix` | `backend` |
| `image_tag_mutability` | `IMMUTABLE` |
| `scan_on_push` | `true` |
| `kms_key_arn` | `null` (AES256) |
| `max_image_count` | `10` |
| `untagged_expire_days` | `14` |
| `force_delete` | `false` |

## Outputs

`repository_url`, `repository_arn`, `repository_name`.

## Compute integration

The compute module already accepts `container_image` — no change needed here (no
circular dependency). Once an image is pushed, set the root's
`backend_container_image` to `<repository_url>:<tag>`. It is left on the
placeholder until then so a first `apply` doesn't try to pull from an empty repo.
