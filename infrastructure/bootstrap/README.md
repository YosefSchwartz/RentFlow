# Bootstrap Layer

This layer provisions the **remote state backend** that every other layer
depends on. It is applied **once**, early in the account's life, and then rarely
touched again. It creates **no application resources** — only the backend.

## What it manages (as code)

| Resource | Purpose |
| --- | --- |
| S3 bucket | Stores OpenTofu/Terraform remote state — private, all public access blocked, versioned, SSE-S3 (AES256) encrypted, TLS-only, with lifecycle cleanup of old versions. |
| DynamoDB table | State **locking** (`LockID` partition key, `PAY_PER_REQUEST` billing) so two runs can never write state at once. |

A **single** bucket and **single** lock table serve **both** staging and
production: each environment uses its own state key inside the bucket
(`staging/terraform.tfstate`, `production/terraform.tfstate`), and DynamoDB locks
per key. The backend is reused, never duplicated per environment.

### Naming

| Resource | Name | Source |
| --- | --- | --- |
| State bucket | `rentflow-tfstate-<account-id>` | `var.state_bucket_name` (must be globally unique) |
| Lock table | `rentflow-tf-lock` | `"${var.project}-tf-lock"` |

### Tags

Every resource is tagged via the provider `default_tags`:
`Project = RentFlow`, `Environment = staging`, `ManagedBy = OpenTofu`
(plus `Owner`). Extend with `var.additional_tags` — no code change needed.

## What must be created manually (and why)

These sit *above* OpenTofu in the trust chain or are the prerequisite for
running it at all. They are the **only** acceptable manual resources:

1. **AWS account** — already configured and active (hosts the active `staging`
   environment). IaC cannot create the account it authenticates into.
2. **IAM Identity Center (SSO)** — instance, permission sets, assignments.
   Already enabled; it is the identity source OpenTofu authenticates *through*.
3. **Local AWS CLI SSO profile** `rentflow-staging` in `~/.aws/config` (see root
   README), so `aws sso login --profile rentflow-staging` works.
4. **This layer's own state on the first run.** Because bootstrap *creates* the
   bucket + lock table, it cannot store state in them on the first run
   (chicken-and-egg). It runs on **local** state, then optionally migrates (see
   below). `backend.tf` holds the ready-to-enable remote backend, disabled until
   the resources exist — so there is no circular dependency.

Everything else in RentFlow infrastructure is managed by OpenTofu.

## Execute

```bash
cd infrastructure/bootstrap

# 1. Authenticate (SSO). Always explicit profile — never the default.
aws sso login --profile rentflow-staging

# 2. Provide inputs. Only state_bucket_name + owner are required;
#    region/profile/environment have RentFlow defaults.
cp terraform.tfvars.example terraform.tfvars   # set state_bucket_name to rentflow-tfstate-<account-id>

# 3. Create the backend (runs on local state).
tofu init
tofu plan
tofu apply
```

Confirm the right account first: `aws sts get-caller-identity --profile rentflow-staging`.

## Migrate this layer to remote state (optional, one-time)

After the first `apply`, you can move bootstrap's own local state into the
bucket it just created:

```bash
tofu output state_bucket_name          # note the bucket name
# edit backend.tf: set `bucket`, then uncomment the terraform { backend "s3" } block
tofu init -migrate-state               # answer "yes" to copy state
```

Keeping bootstrap state local is also acceptable for a small team (bootstrap
changes are rare) — the migration is a convenience, not a requirement.

## Wire the backend into environments

Copy the outputs into each environment's backend config:

- `state_bucket_name`       → `../terraform/environments/*/backend.hcl` → `bucket`
- `dynamodb_lock_table_name` → `../terraform/environments/*/backend.hcl` → `dynamodb_table`

## Destroying

Do **not** casually destroy this layer — it holds the state of every other
layer. `force_destroy_state_bucket` defaults to `false` precisely so the bucket
cannot be emptied and deleted by accident.
