# RentFlow Infrastructure (OpenTofu)

Infrastructure as Code for RentFlow's AWS environments. From this point on, **all
AWS resources are managed here**, in [OpenTofu](https://opentofu.org)
(Terraform-compatible). The only manually-created resources are the minimum
bootstrap prerequisites, documented below and in [`bootstrap/`](bootstrap/).

This folder is part of the RentFlow monorepo alongside [`../server`](../server)
(backend) and [`../mobile`](../mobile) (mobile).

> **Note on directory names.** The application folders are `server/` and
> `mobile/`, but internal runtime identifiers (database name, Docker resources,
> local bucket names, package names, mobile bundle id) still use `keynest`.
> These are technical identifiers, not branding, and
> renaming them is a separate, higher-risk change tracked as follow-up work (see
> the repo root README). The RentFlow **AWS naming convention below is
> authoritative for all new/managed AWS resources.**

---

## ⚠️ AWS profile safety — read first

RentFlow uses **AWS IAM Identity Center (SSO)**. There are **no access keys** and
**no hardcoded credentials** anywhere in this repo.

**The AWS account is already configured and active. `staging` is the current
active environment.** To prevent operating against the wrong AWS account, every
AWS CLI command **must** be scoped to the RentFlow profile:

```bash
--profile rentflow-staging
```

Rules — no exceptions:

- **Never** use the `default` AWS profile.
- **Always** pass `--profile rentflow-staging` explicitly on every `aws` command.
- **Always** authenticate first: `aws sso login --profile rentflow-staging`.
- All infrastructure operations must be scoped to the **RentFlow AWS account only**.

Recommended guard — confirm you are in the right account before doing anything:

```bash
unset AWS_PROFILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
aws sts get-caller-identity --profile rentflow-staging   # verify the account id
```

> `production` will be added later and will use `--profile rentflow-production`.
> Until it exists, treat `rentflow-staging` as the only valid profile.

---

## Architecture overview

- **Tool:** OpenTofu, standard Terraform syntax (no CloudFormation, no CDK).
- **Auth:** AWS IAM Identity Center (SSO) via named CLI profiles. No access keys.
- **State:** a single S3 backend, one **state key per environment**
  (`staging/terraform.tfstate`, `production/terraform.tfstate`), encrypted at
  rest with SSE-S3 (AES256). **Locking** uses a shared **DynamoDB table**
  (`LockID`, `PAY_PER_REQUEST`). Both are created by `bootstrap/`.
- **Composition:** each environment under `terraform/environments/<env>/` is its
  own thin **root module** — you run `tofu` from inside it. Shared logic lives in
  `terraform/modules/` (added as resources are introduced) so it is never
  duplicated between environments. Environments differ only by their `main.tf`
  backend key, `backend.hcl`, and `*.tfvars`.
- **Reusability:** infrastructure is built from small modules under
  `terraform/modules/`. `foundation` (naming/tags/validation), `networking`
  (VPC), `security` (VPC flow logs), `identity` (Cognito), `storage` (S3),
  `database` (RDS PostgreSQL), `compute` (ECS Fargate + ALB),
  `container_registry` (ECR), `cicd` (GitHub OIDC), and `notifications` (SES
  transactional email) are implemented; the rest are scaffolded.
- **Naming & tagging:** every resource will be named `rentflow-<env>-<suffix>`
  and carry the standard tag set, defined in the shared modules as they are
  built (kept in one place, never duplicated per environment).

### Naming

`local.name_prefix = "<project>-<environment>"` → e.g. `rentflow-staging`.
Modules append their own suffix (`rentflow-staging-vpc`, `rentflow-staging-files`).
No names are hardcoded or duplicated.

### Tagging

The standard tag set applied to every resource (via the provider's
`default_tags`, reintroduced with the shared modules):

| Tag | Value |
| --- | --- |
| `Project` | `RentFlow` |
| `Environment` | `staging` / `production` |
| `Owner` | team/owner email |
| `ManagedBy` | `OpenTofu` |

Extra tags are added per environment via an `additional_tags` input, without
changing module code. (See the bootstrap layer, which already applies this set.)

---

## Folder structure

```
infrastructure/
├── README.md                  # this file
├── .gitignore
│
├── bootstrap/                 # one-time backend bootstrap (local state)
│   ├── main.tf                # state S3 bucket + DynamoDB lock table
│   ├── backend.tf             # remote backend, disabled until first apply
│   ├── providers.tf variables.tf outputs.tf versions.tf
│   ├── terraform.tfvars.example
│   └── README.md
│
└── terraform/
    ├── modules/               # reusable building blocks (shared)
    │   ├── foundation/        # ✅ Layer 2 — naming, tags, validation (no resources)
    │   ├── networking/        # ✅ Layer 3 — VPC, subnets, routing + Layer 9 — VPC endpoints
    │   ├── security/          # ✅ Layer 4 — VPC flow logs (KMS/secrets/SGs later)
    │   ├── identity/          # ✅ Layer 5 — Cognito user pool + mobile client
    │   ├── storage/           # ✅ Layer 6 — secure private S3 bucket
    │   ├── database/          # ✅ Layer 7 — RDS PostgreSQL (private, encrypted)
    │   ├── compute/           # ✅ Layer 8 — ECS Fargate + ALB + autoscaling
    │   ├── container_registry/ # ✅ Layer 10 — private ECR repo + lifecycle
    │   ├── cicd/              # ✅ Layer 11 — GitHub OIDC + deploy role
    │   ├── acm/               # TLS certificates
    │   ├── route53/           # DNS
    │   ├── cloudfront/        # CDN
    │   ├── lambda/            # function primitive
    │   ├── api_gateway/       # HTTP API surface
    │   ├── notifications/     # ✅ SES transactional email — OTP (+ future SNS push)
    │   └── monitoring/        # CloudWatch, Budgets, Cost Anomaly Detection
    │
    └── environments/          # one root module per environment (run tofu here)
        ├── staging/           # main.tf (backend) + backend.hcl + staging.tfvars (ACTIVE)
        └── production/        # same shape (backend prepared; no resources yet)
```

`foundation/` (Layer 2), `networking/` (Layer 3), `security/` (Layer 4),
`identity/` (Layer 5), `storage/` (Layer 6), `database/` (Layer 7), and
`compute/` (Layer 8), `container_registry/` (Layer 10), `cicd/` (Layer 11), and
`notifications/` (SES OTP email) are **implemented** (networking also provides
Layer 9 VPC endpoints). The remaining modules are still **structure only** — each has a `README.md`
describing its purpose, planned resources, and expected inputs/outputs, with no
resources yet.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the layer model, the networking
diagram, the subnet strategy, and the future dependency graph, and
[`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md) for the pre-deployment
checklist and remaining blockers.

---

## Layer 2 — Foundation

[`terraform/modules/foundation`](terraform/modules/foundation/) is the shared
layer every environment root calls once and every future module consumes. It
**creates no AWS resources**.

**Purpose:** one source of truth for naming, tags, and safety validation, so no
downstream module ever hardcodes a name, re-defines the tag set, or re-checks
the account/region.

**Naming strategy:** `name_prefix = "<project-slug>-<environment>"` →
`rentflow-staging`. Modules append a suffix: `rentflow-staging-api`,
`rentflow-staging-db`, `rentflow-staging-documents`, `rentflow-production-api`.

**Common tags:** `Project`, `Application`, `Environment`, `ManagedBy`, `Owner`,
plus anything in `additional_tags` — extended without editing any module.

**Validation strategy (planning fails on any breach):**

| Check | Mechanism | Fails at |
| --- | --- | --- |
| environment ∈ {staging, production} | `variable` validation | variable evaluation |
| region == `eu-central-1` | `variable` validation | variable evaluation |
| account == expected `aws_account_id` | `data.aws_caller_identity` **postcondition** | `tofu plan` (hard error) |

**Usage (root → foundation → other modules):**

```hcl
module "foundation" {
  source         = "../../modules/foundation"
  environment    = var.environment       # staging | production
  aws_region     = var.aws_region        # eu-central-1
  aws_account_id = var.aws_account_id     # 304126178791 (staging)
}

# future modules receive naming + tags; they add none of their own:
module "networking" {
  source      = "../../modules/networking"
  name_prefix = module.foundation.name_prefix
  tags        = module.foundation.common_tags
}
```

See [`modules/foundation/README.md`](terraform/modules/foundation/README.md) for
full details.

---

## Prerequisites (manual, one-time)

These sit above OpenTofu in the trust chain and are the only acceptable manual
resources (details in [`bootstrap/README.md`](bootstrap/README.md)):

1. **AWS account + IAM Identity Center (SSO)** — already configured and active.
   SSO is the identity source OpenTofu authenticates *through*, so it exists
   before any OpenTofu run.
2. **Local SSO profile** in `~/.aws/config` for the active (staging) account:

   ```ini
   [sso-session rentflow]
   sso_start_url = https://<your-org>.awsapps.com/start
   sso_region    = eu-central-1

   [profile rentflow-staging]
   sso_session    = rentflow
   sso_account_id = <configured-account-id>
   sso_role_name  = AdministratorAccess
   region         = eu-central-1
   ```

   Authenticate with `aws sso login --profile rentflow-staging`.
   (A `rentflow-production` profile is added when production is stood up.)

---

## Getting started

### 1. Bootstrap the backend (once)

```bash
cd infrastructure/bootstrap
cp terraform.tfvars.example terraform.tfvars   # set account id + bucket name
aws sso login --profile rentflow-staging

tofu init
tofu apply
```

Copy the outputs (`state_bucket_name`, `dynamodb_lock_table_name`) into
`../terraform/environments/staging/backend.hcl`.

### 2. Work in the staging environment

Each environment is its own root module — run `tofu` **from inside the env
folder**:

```bash
cd infrastructure/terraform/environments/staging
aws sso login --profile rentflow-staging

# init the S3 backend (values come from backend.hcl)
tofu init -backend-config=backend.hcl

# plan / apply with staging values. Two required, never-committed vars:
#   backend_image_tag — private-ECR image tag (git SHA); build + push it first.
#   ses_sender_email  — the verified SES sender address for OTP email.
# (JWT / OTP / DB secrets are auto-generated in main.tf via random_password and
#  stored in Secrets Manager — they are NOT passed as vars.)
tofu plan -var-file=staging.tfvars \
  -var "backend_image_tag=$(git rev-parse --short HEAD)" \
  -var "ses_sender_email=$SES_SENDER_EMAIL"
tofu apply -var-file=staging.tfvars \
  -var "backend_image_tag=$(git rev-parse --short HEAD)" \
  -var "ses_sender_email=$SES_SENDER_EMAIL"
```

OpenTofu reads the AWS profile from `staging.tfvars` (`aws_profile =
"rentflow-staging"`), so every run is scoped to the RentFlow account.

### 3. Deploy the backend image (private ECR)

The ECS tasks pull the backend image from the **private** ECR repo
`rentflow-staging-backend` — manifests over the Layer 9 NAT gateway, layers
over the free S3 gateway endpoint; there is no public registry, so the image
**must** live in that private repo. The task definition is **ARM64 (Graviton)**,
so build **linux/arm64** images (CI does this via buildx/QEMU). Build and push
a SHA-tagged image, then point ECS at it:

```bash
# From the repo root. Values: account 304126178791, region eu-central-1.
export AWS_PROFILE=rentflow-staging          # explicit profile, no static keys
ECR_URL=$(cd infrastructure/terraform/environments/staging && tofu output -raw ecr_repository_url)
SHA=$(git rev-parse --short HEAD)

# 1. Authenticate Docker to the private ECR registry (SSO-backed profile).
aws ecr get-login-password --profile rentflow-staging --region eu-central-1 \
  | docker login --username AWS --password-stdin "${ECR_URL%/*}"

# 2. Build for the Fargate architecture (linux/amd64) from ./server and tag
#    with the immutable git SHA (no ":latest" — tags are immutable).
docker build --platform linux/amd64 -t "$ECR_URL:$SHA" ./server

# 3. Push the SHA tag.
docker push "$ECR_URL:$SHA"

# 4. Point ECS at the pushed image. Terraform updates the task definition; DB
#    password, JWT, and OTP secrets are auto-generated in main.tf and injected
#    from Secrets Manager (no secret vars on the command line).
cd infrastructure/terraform/environments/staging
tofu apply -var-file=staging.tfvars \
  -var "backend_image_tag=$SHA" \
  -var "ses_sender_email=$SES_SENDER_EMAIL"
```

Notes:
- **`--platform linux/amd64`** is required — Fargate runs X86_64; an
  Apple-Silicon build (`arm64`) would fail with an exec-format error.
- The app must be reachable at **`/api/health`** on port **3000** (wired as the
  ALB health check and container port).
- Ongoing deploys use the GitHub Actions OIDC workflow
  (`.github/workflows/backend-deploy.yml`), which is unchanged.

#### Runtime configuration (injected into the task)

The task definition provides the backend's config. The app signs its **own**
JWTs (HS256) and uses DB-backed refresh sessions — it does **not** use Cognito at
runtime, so no `COGNITO_*` vars are injected. Non-secret config is passed as plain
`environment` entries; secrets are generated in `main.tf` (`random_password`),
stored in Secrets Manager, and injected via the `secrets` block (never in state,
never in the task definition):

| Variable | Source |
| --- | --- |
| `NODE_ENV`, `PORT`, `AWS_REGION`, `S3_BUCKET_NAME` | plain `environment` (module + storage outputs) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME` | plain `environment` (database module outputs; non-secret parts) |
| `EMAIL_PROVIDER`, `SES_SENDER_EMAIL` | plain `environment` (SES OTP delivery; notifications module) |
| `AI_ENABLED`, `AI_PROVIDER`, `AI_MODEL_ID`, `AI_AWS_REGION` | plain `environment` (AI platform, PR3; feature-flagged by `ai_enabled`) |
| `DB_PASSWORD`, `JWT_SECRET`, `OTP_SECRET` | `secrets` block → generated Secrets Manager secrets (injected by the ECS **execution** role) |
| `DATABASE_URL` | composed at container start from the DB parts (`sslmode=require`); password URL-encoded via `node` |

IAM: the ECS **execution** role gets `secretsmanager:GetSecretValue` scoped to
exactly the DB, JWT, and OTP secret ARNs (no wildcards). The **task role** carries
scoped, opt-in inline policies: **S3** object access (documents / media /
attachments), **SES** send from the verified sender identity (OTP email),
**Bedrock** `InvokeModel` when AI is enabled, and **SSM Messages** for ECS Exec.

---

## Environment separation

Both environments share **one** state bucket and **one** lock table (created by
`bootstrap/`), isolated by **state key** — never overwriting or locking each
other:

| | Staging | Production |
| --- | --- | --- |
| Status | **active** | backend prepared (no resources yet) |
| State bucket | `rentflow-tfstate-304126178791` | *(same)* |
| State key | `staging/terraform.tfstate` | `production/terraform.tfstate` |
| Lock table | `rentflow-tf-lock` | *(same)* |
| State access profile (`backend.hcl`) | `rentflow-staging` | `rentflow-staging` |
| Resource profile (`*.tfvars`) | `rentflow-staging` | `rentflow-production` |

The **state access profile** is the account that owns the state bucket (the
active account) — the same for both. The **resource profile** is where each
environment's resources are provisioned; production points at a separate account
as the org grows (a hard blast-radius boundary — the Well-Architected
recommendation).

Both environments use the **same root module**, so anything proven in staging
promotes to production by changing only the `-var-file` and `backend.hcl`.

---

## Future module strategy

Modules are added **incrementally**, wired into each environment root
(`environments/<env>/main.tf`) one at a time, in dependency order. Each receives
`name_prefix` + `common_tags` from `foundation`:

0. **foundation** — naming, tags, validation ✅ *(done — Layer 2)*
1. **networking** — VPC, subnets, routing ✅ *(done — Layer 3; SGs/NAT/endpoints later)*
2. **security** — VPC flow logs baseline ✅ *(done — Layer 4; KMS/Secrets/SGs later)*
3. **identity** — Cognito user pool + mobile client ✅ *(done — Layer 5)*
4. **storage** — secure private S3 bucket ✅ *(done — Layer 6)*
5. **database** — RDS PostgreSQL in private subnets ✅ *(done — Layer 7)*
6. **compute** — ECS Fargate + ALB + autoscaling ✅ *(done — Layer 8)*
7. **private connectivity** — single NAT gateway + free S3 gateway endpoint (interface-endpoint mode still available per env) ✅ *(done — Layer 9, in `networking`; switched to NAT in the Jul 2026 FinOps review)*
8. **container_registry** — private ECR repo + lifecycle ✅ *(done — Layer 10)*
9. **cicd** — GitHub Actions OIDC + deploy role ✅ *(done — Layer 11; workflow at `.github/workflows/backend-deploy.yml`)*
10. **notifications** — SES transactional email (OTP) ✅ *(done; wired in staging `main.tf` as `module "notifications"`; SNS push is future)*
11. **monitoring** — AWS Budgets + Cost Anomaly Detection ✅ *(done — Layer 12; CloudWatch alarms/dashboards are future)*
11. **acm + route53** — certificates and DNS *(future)*
12. **cloudfront** — CDN + signed downloads *(future)*
13. **lambda + api_gateway** — serverless surfaces as needed *(future)*
14. **monitoring** — CloudWatch, Budgets, Cost Anomaly Detection *(future)*

Each module ships with secure defaults (encryption, private-by-default, least
privilege) and exposes only non-sensitive outputs. Secrets stay in Secrets
Manager and are referenced by ARN — never written to state outputs.

The **AI document-intelligence platform** (PR3) is layered onto compute rather
than a standalone module: it adds `bedrock:InvokeModel` permissions to the ECS
task role (scoped to the configured model / inference-profile ARNs) and the
`AI_*` runtime env vars. It is feature-flagged by `ai_enabled` (default `false`;
`true` in staging, using a Bedrock inference profile) and stays fully opt-in —
no Bedrock grant is created unless AI is enabled with the `bedrock` provider.

---

## CI/CD readiness (GitHub Actions, future)

The layout is ready for pipeline automation without changes:

- **Auth:** GitHub Actions authenticates via **OIDC** to a dedicated IAM deploy
  role per environment (no stored AWS keys). The role is defined in the
  `security` module.
- **Per-environment jobs:** a workflow selects the environment by passing the
  matching `-backend-config` + `-var-file`; nothing else differs.
- **Standard flow:** `fmt -check` → `validate` → `plan` (on PR) → `apply` (on
  merge to the environment's branch, gated by an environment protection rule).
- **State locking** is handled by S3, so parallel CI runs are safe.

---

## Conventions & guardrails

- Simplicity over cleverness; the simplest option that scales.
- SSO only — no access keys; always `--profile rentflow-staging`.
- No secrets in code, committed tfvars, or outputs.
- Every resource tagged and named through the shared modules (one place).
- Prefer reusable modules; avoid duplication and premature abstraction.
