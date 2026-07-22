# Staging Environment

This folder **is** the OpenTofu root module for the **staging** environment —
you run `tofu` from inside it. It stays thin: shared logic lives in
`../../modules/` (added as resources are introduced) so nothing is duplicated
between environments.

| File | Purpose |
| --- | --- |
| `main.tf` | Backend block + AWS provider + the full environment stack: `foundation`, `networking`, `security`, `identity`, `storage`, `database`, `compute`, `notifications`, `container_registry`, `cicd`, plus the generated app secrets (DB / JWT / OTP). No hardcoded backend values. |
| `variables.tf` | Thin input interface (provider + values passed through to the modules). |
| `outputs.tf` | Surfaces environment outputs (naming/tags plus module outputs such as `ecr_repository_url`). |
| `backend.hcl` | Remote-state backend settings (bucket, state key, DynamoDB lock table). |
| `staging.tfvars` | Environment-varying values (region, profile, account id, tags, sizing, AI platform config). |

## Remote state

State is stored remotely in the backend created by the [`bootstrap`](../../../bootstrap/)
layer — this environment **depends on bootstrap having run first**.

| Setting | Value |
| --- | --- |
| Bucket | `rentflow-tfstate-304126178791` (shared with production) |
| Key | `staging/terraform.tfstate` |
| Region | `eu-central-1` |
| Locking | DynamoDB `rentflow-tf-lock` |
| Encryption | SSE-S3 (`encrypt = true`) |
| State access profile | `rentflow-staging` |

Staging and production share one bucket and one lock table; they are isolated
by **state key** (`staging/…` vs `production/…`), so they never overwrite or
lock each other.

## Usage

Run all commands **from inside this folder**:

```bash
cd infrastructure/terraform/environments/staging
aws sso login --profile rentflow-staging

# Initialize the S3 backend (values come from backend.hcl)
tofu init -backend-config=backend.hcl

# Two required, never-committed vars:
#   backend_image_tag — private-ECR backend image tag (git SHA); build + push first.
#   ses_sender_email  — verified SES sender address for OTP email.
# (JWT / OTP / DB secrets are auto-generated in main.tf and stored in Secrets
#  Manager — they are NOT passed as vars.)
tofu plan  -var-file=staging.tfvars \
  -var "backend_image_tag=$(git rev-parse --short HEAD)" \
  -var "ses_sender_email=$SES_SENDER_EMAIL"
tofu apply -var-file=staging.tfvars \
  -var "backend_image_tag=$(git rev-parse --short HEAD)" \
  -var "ses_sender_email=$SES_SENDER_EMAIL"
```

Because each environment is its own root module with its own state key,
switching environments is just `cd`-ing into the other folder — no
`-reconfigure` juggling.

## AI platform config

`staging.tfvars` also carries the AI document-intelligence platform config
(`ai_enabled`, `ai_provider`, `ai_model_id`). AI is **enabled** in staging using
an Amazon Bedrock inference profile; `main.tf` derives the scoped
`bedrock:InvokeModel` grant on the ECS task role from these values (opt-in — no
Bedrock access is granted when `ai_enabled` is false or the provider is not
`bedrock`).
