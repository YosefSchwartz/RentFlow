# Production Environment

**Backend prepared; no resources provisioned yet.** This folder exists so that
standing up production later is a matter of filling in values and running
`apply` — no restructuring.

It mirrors `../staging` — its own thin root module, sharing logic through
`../../modules/`:

| File | Purpose |
| --- | --- |
| `main.tf` | Backend block + AWS provider + `module "foundation"` call. No hardcoded backend values. |
| `variables.tf` | Thin input interface (provider + values passed through to foundation). |
| `outputs.tf` | Surfaces foundation outputs (`name_prefix`, `common_tags`, `account_id`). |
| `backend.hcl` | Remote-state backend settings for the production state key. |
| `production.tfvars` | Production values (region, profile, account id, tags). |

## Remote state

State is stored remotely in the backend created by the [`bootstrap`](../../../bootstrap/)
layer — production **depends on bootstrap having run first**.

| Setting | Value |
| --- | --- |
| Bucket | `rentflow-tfstate-304126178791` (shared with staging) |
| Key | `production/terraform.tfstate` |
| Region | `eu-central-1` |
| Locking | DynamoDB `rentflow-tf-lock` |
| Encryption | SSE-S3 (`encrypt = true`) |
| State access profile | `rentflow-staging` (the account that owns the bucket) |

Only the **state key** differs from staging (`production/…` vs `staging/…`);
the shared bucket + lock table keep the two environments isolated.

### Two profiles, on purpose

- **State access** (`backend.hcl` → `profile`) uses **`rentflow-staging`**,
  because the state bucket lives in the active account.
- **Resource provisioning** (`production.tfvars` → `aws_profile`) uses
  **`rentflow-production`**, the account production resources are created in.

## Usage (when ready)

```bash
cd infrastructure/terraform/environments/production
aws sso login --profile rentflow-staging      # for state (backend) access
aws sso login --profile rentflow-production   # for provisioning resources

tofu init -backend-config=backend.hcl
tofu plan  -var-file=production.tfvars
tofu apply -var-file=production.tfvars
```
