# Staging Environment

This folder **is** the OpenTofu root module for the **staging** environment —
you run `tofu` from inside it. It stays thin: shared logic lives in
`../../modules/` (added as resources are introduced) so nothing is duplicated
between environments.

| File | Purpose |
| --- | --- |
| `main.tf` | Backend block + AWS provider + `module "foundation"` call. No hardcoded backend values. |
| `variables.tf` | Thin input interface (provider + values passed through to foundation). |
| `outputs.tf` | Surfaces foundation outputs (`name_prefix`, `common_tags`, `account_id`). |
| `backend.hcl` | Remote-state backend settings (bucket, state key, DynamoDB lock table). |
| `staging.tfvars` | Environment-varying values (region, profile, account id, tags). |

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

tofu plan  -var-file=staging.tfvars
tofu apply -var-file=staging.tfvars
```

Because each environment is its own root module with its own state key,
switching environments is just `cd`-ing into the other folder — no
`-reconfigure` juggling.
