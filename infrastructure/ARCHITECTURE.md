# RentFlow Infrastructure — Architecture

How the OpenTofu infrastructure is layered, how the network is designed, and how
future modules depend on what exists today. See [`README.md`](README.md) for
operational commands.

## Layer model

Infrastructure is built in **layers**, each consuming the layer(s) below. Every
layer is a reusable module under `terraform/modules/`, wired into each
environment root (`terraform/environments/<env>`).

| Layer | Module | Creates AWS resources? | Purpose |
| --- | --- | --- | --- |
| 1 — Bootstrap | `bootstrap/` | yes (state bucket + lock table) | Remote-state backend (run once, local state) |
| 2 — Foundation | `modules/foundation` | **no** | Naming, tags, account/region/environment validation |
| 3 — Networking | `modules/networking` | **yes** | VPC, subnets, routing |
| 4 — Security baseline | `modules/security` | **yes** | VPC flow logs + least-privilege role |
| 5 — Identity | `modules/identity` | **yes** | Cognito user pool + mobile client |
| 6 — Storage | `modules/storage` | **yes** | Secure private S3 bucket |
| 7 — Database | `modules/database` | **yes** | RDS PostgreSQL (private, encrypted) |
| 8 — Compute | `modules/compute` | **yes** | ECS Fargate + ALB + autoscaling |
| 9 — Private connectivity | `modules/networking` (extended) | **yes** | VPC endpoints (no NAT) |
| 10 — Container registry | `modules/container_registry` | **yes** | Private ECR repo + lifecycle |
| 11 — CI/CD | `modules/cicd` | **yes** | GitHub OIDC provider + deploy role |
| 12+ — (future) | `acm`, `route53`, `cloudfront`, … | yes | Edge / DNS / TLS |

Rule: a module never hardcodes names or tags — it receives `name_prefix` and
`common_tags` from Foundation and passes them down.

## Layer 3 — Networking

Region **eu-central-1**, one VPC per environment, subnets spread across **2 AZs**.

```
                          Internet
                             │
                     ┌───────┴────────┐
                     │ Internet Gateway│
                     └───────┬────────┘
                             │  (0.0.0.0/0)
                   ┌─────────┴──────────┐  public route table (shared)
                   │                    │
        ┌──────────┴─────────┐ ┌────────┴───────────┐
        │  VPC 10.0.0.0/16   │ │                    │
        │                    │ │                    │
   AZ eu-central-1a          │ │   AZ eu-central-1b │
   ───────────────────────── │ │ ───────────────────────────
   public   10.0.0.0/24  ────┘ └──── public   10.0.1.0/24     → IGW
   app      10.0.16.0/24  ─ per-AZ RT ─ app    10.0.17.0/24    (local only, NAT-ready)
   db       10.0.32.0/24  ─ database RT ─ db    10.0.33.0/24   (local only, isolated)
```

**Route tables**

| Table | Scope | Routes | Associated subnets |
| --- | --- | --- | --- |
| public | shared | local + `0.0.0.0/0` → IGW | both public |
| private-app | per-AZ (2) | local only (NAT added later, per AZ) | app subnet in that AZ |
| database | shared | local only (no internet, ever) | both db subnets |

### Subnet strategy

`/24` subnets inside the `/16`, grouped by tier with a reserved 16-block range
so AZs/subnets can be added without renumbering:

| Tier | Offset | Reserved `/24` slots | AZ-a | AZ-b |
| --- | --- | --- | --- | --- |
| public | 0 | 0–15 | `10.0.0.0/24` | `10.0.1.0/24` |
| private-app | 16 | 16–31 | `10.0.16.0/24` | `10.0.17.0/24` |
| private-db | 32 | 32–47 | `10.0.32.0/24` | `10.0.33.0/24` |

- CIDRs computed with `cidrsubnet()`; AZ names from `data.aws_availability_zones`.
- **Distinct `/16` per environment** (staging `10.0.0.0/16`, production
  `10.1.0.0/16`) to keep future VPC peering / transit gateway possible.

### Egress strategy

**No NAT Gateway.** Private-subnet egress to AWS services is provided by **VPC
endpoints** (Layer 9, below) instead — cheaper at this scale and keeps traffic
on the AWS backbone. Private route tables remain per-AZ, so an HA NAT could be
added later (with no re-association) if general outbound internet access is ever
required.

## Layer 4 — Security baseline

`modules/security` establishes secure defaults **before** application services
exist. It consumes Foundation (`name_prefix`, `common_tags`, `account_id`) and
Networking (`vpc_id`).

### VPC Flow Logs

```
        VPC (networking)
             │  all traffic (ACCEPT + REJECT)
             ▼
      aws_flow_log ──assumes──► IAM role (vpc-flow-logs.amazonaws.com only,
             │                            aws:SourceAccount = this account)
             ▼                            └─ inline policy: write ONLY to the
   CloudWatch Logs group                     one log group (no wildcards)
   /rentflow-<env>/vpc/flow-logs
   retention: 30d (configurable)
```

- **Least privilege:** the role is assumable only by the flow-logs service from
  this account; permissions are `CreateLogStream` / `PutLogEvents` /
  `DescribeLogStreams` scoped to the single group ARN. No `CreateLogGroup`, no
  `*` resources.
- **Encryption:** log group uses default CloudWatch Logs encryption at rest; an
  optional `log_kms_key_arn` input allows a customer-managed key later without
  creating one now.

### Account-level security expectations (documented, not yet provisioned)

These are account-wide singletons. They belong in a dedicated **account layer**
(not a per-environment root, which would fight over the same setting), so they
are documented here as the baseline to apply there:

| Expectation | Baseline |
| --- | --- |
| S3 public access | Enable the **account-level S3 Public Access Block** (block all 4 flags). Each bucket also sets its own block (bootstrap state bucket already does). |
| Secure transport | Deny non-TLS access via bucket/resource policies (`aws:SecureTransport = false`). The bootstrap state bucket already enforces this. |
| Encryption at rest | SSE on by default everywhere (S3 SSE-S3/KMS, RDS KMS, CloudWatch Logs). Customer-managed KMS for sensitive data domains. |
| IAM | SSO for humans, OIDC for CI — **no long-lived access keys**. Least-privilege, scoped roles. **No broad administrative roles** created by IaC. |

### Security roadmap

1. **KMS** — customer-managed keys per data domain (RDS, S3, logs) with rotation.
2. **Secrets Manager / SSM** — DB credentials, JWT secret, third-party keys (ARNs only in state).
3. **Security groups** — least-privilege SGs (ALB→app→db) in the networking/security boundary.
4. **GuardDuty / Config / CloudTrail** — account-level detection & audit.
5. **WAF** — web ACL on public endpoints (CloudFront / ALB).
6. **Account S3 Public Access Block** — applied from the account layer.

## Layer 5 — Identity (Cognito)

`modules/identity` provides managed authentication for the mobile apps and, via
OIDC, future backend services. It consumes Foundation naming/tags only, and
creates **no IAM users, app credentials, or backend permissions**.

> **Provisioning vs. migration.** This layer stands up the identity
> *infrastructure*. The backend today still authenticates with its own JWT +
> DB-backed rotating sessions (CLAUDE.md). Migrating the apps/backend onto
> Cognito is a separate application change; the OIDC outputs below are what that
> migration will consume.

### Resources

- **User pool** (`rentflow-<env>-users`): email sign-in (case-insensitive),
  email verification, password ≥12 with all character classes, recovery via
  verified email only, MFA `OPTIONAL` (TOTP), threat protection `AUDIT`,
  deletion protection.
- **Mobile app client** (`rentflow-<env>-mobile`): public (no secret), SRP +
  refresh only, 15m access/id + 30d refresh, enumeration protection, token
  revocation.
- **No groups.** RentFlow has no roles — authorization derives from ownership +
  active lease. Groups would model roles the domain does not have.

### Authentication flow (SRP)

```
  Mobile app ──SRP (password never sent)──►  Cognito user pool
       ▲                                          │
       │  id + access (15m) + refresh (30d)  ◄─────┘
       │
       │  access/id JWT (Bearer)
       ▼
  Backend API ──validate signature/claims──►  OIDC discovery + JWKS
                                              issuer_url/.well-known/openid-configuration
```

1. App signs in via SRP (Amplify / Cognito SDK) — the password never leaves the device.
2. Cognito returns ID + access (15 min) + refresh (30 days) tokens.
3. App calls the backend with the access/ID JWT as a Bearer token.
4. Backend validates the JWT signature and claims against the pool's JWKS,
   discovered from `discovery_endpoint` — no shared secret, no Cognito API call
   per request.
5. Refresh tokens rotate/renew sessions; revocation supports logout / global
   sign-out.

### Mobile integration notes

- Wire with `user_pool_id` + `user_pool_client_id` (public client, **no secret**
  to embed).
- Recommended: AWS Amplify Auth or the Cognito Identity Provider SDK using the
  **SRP** flow (matches `ALLOW_USER_SRP_AUTH`).
- Token lifetimes already match the app's model (15-minute access, 30-day refresh).
- MFA is opt-in (TOTP); surface an "enable MFA" setting in the app.
- Both iOS and Android use the same client (no per-platform secret).

## Layer 6 — Storage

`modules/storage` provides one secure, private S3 bucket
(`rentflow-<env>-storage`) for application data: property images, user
documents, contracts, generated reports, and uploads. It consumes Foundation
naming/tags only and is **VPC-independent**. Creates **no IAM, public policy, or
CloudFront**.

### Security posture

```
  ┌──────────────────── rentflow-<env>-storage ────────────────────┐
  │ Public access block .......... all 4 flags ON                   │
  │ ACLs .......................... disabled (BucketOwnerEnforced)   │
  │ Encryption at rest ............ SSE-S3 (AES256); SSE-KMS optional│
  │ Transport ..................... bucket policy denies non-TLS     │
  │ Versioning .................... enabled                          │
  │ Lifecycle ..................... abort MPU 7d · noncurrent 90d     │
  └─────────────────────────────────────────────────────────────────┘
```

### Data ownership model

- **The RentFlow account owns every object** — `BucketOwnerEnforced` disables
  ACLs, so uploaders can never retain object ownership or grant public access.
- **User data is retained** — lifecycle only aborts orphaned multipart uploads
  and expires *non-current* versions; **current objects are never auto-deleted**.
  Versioning preserves prior copies (accidental overwrite/delete recovery).
- **No public exposure** — all public access is blocked; objects are reached
  only via the backend (presigned URLs or an authorized app role).
- **Cost awareness** — versioning is bounded by the 90-day non-current expiry;
  incomplete uploads are cleaned after 7 days. Future: lifecycle transitions
  (Standard-IA / Glacier) or Intelligent-Tiering for cold data.

### Future upload flow (presigned URLs)

```
  Mobile / web app                Backend (S3StorageProvider)         S3 bucket
        │  1. request upload URL        │                                 │
        │ ─────────────────────────────►│  2. generate presigned PUT      │
        │                               │ ───────(scoped, expiring)──────►│
        │  3. presigned URL             │                                 │
        │ ◄─────────────────────────────│                                 │
        │  4. PUT object directly (TLS) ────────────────────────────────►│
        │                               │  5. store object key in DB      │
        │                               │     (Property / Lease / Doc)    │
```

- The backend never proxies bytes — it issues short-lived presigned URLs scoped
  to a single object key; clients upload/download directly over TLS.
- Browser clients uploading directly need CORS — set `cors_allowed_origins`
  (no wildcard). Native mobile SDK uploads do not require CORS.
- A future least-privilege app role (compute layer) grants the backend
  `s3:GetObject`/`PutObject`/`DeleteObject` on this bucket's ARN only.

## Layer 7 — Database (RDS PostgreSQL)

`modules/database` provisions managed PostgreSQL for the backend's relational
data. Consumes Foundation (naming/tags) and Networking (`vpc_id`,
`private_db_subnet_ids`).

### Topology

```
   VPC 10.0.0.0/16
   ┌───────────────────────── private DB subnets (no internet route) ─────────┐
   │   eu-central-1a  10.0.32.0/24            eu-central-1b  10.0.33.0/24       │
   │        │                                       │                          │
   │        └──────────── DB subnet group ──────────┘                          │
   │                          │                                                │
   │              ┌───────────┴───────────┐   multi_az=false (staging)         │
   │              │  RDS PostgreSQL (5432) │   multi_az=true  (production → standby in AZ-b)
   │              │  publicly_accessible=NO│                                    │
   │              └───────────┬───────────┘                                    │
   │        SG: ingress 5432 ONLY from allowed SGs/CIDRs (none yet) · egress: deny-all
   └───────────────────────────────────────────────────────────────────────────┘
```

### Security model

- **Private only** — private DB subnets, `publicly_accessible = false`, no
  internet route (the database route table has no NAT/IGW).
- **Ingress** — port 5432 reachable **only** from `allowed_security_group_ids` /
  `allowed_cidr_blocks` (empty by default → unreachable). `0.0.0.0/0` is rejected
  by input validation. **Egress deny-all** (RDS needs no instance-SG egress).
- **Encryption** — at rest (`storage_encrypted`, optional CMK) and in transit
  (`rds.force_ssl = 1`).
- **Protection** — deletion protection on, automated backups (7d staging / 30d
  prod), final snapshot on destroy, storage autoscaling.

### Secret management

```
  RDS ──generates master password──► Secrets Manager secret (RDS-managed, rotatable)
                                            │  secret_arn (output)
  Terraform state ── contains NO password ──┘   (manage_master_user_password = false)
```

- `manage_master_user_password = false` — RDS creates and owns the master
  credential secret; the password never enters Terraform variables, **state**, or
  the repository.
- The module exposes only `secret_arn` (never the password). Consumers get
  `secretsmanager:GetSecretValue` on that ARN alone.

### Future backend connection flow

```
   Backend (ECS/compute, future)
        │  1. app security group created in the compute layer
        ▼
   database module input: allowed_security_group_ids = [app_sg]   → opens 5432 app→db
        │
        │  2. read secret_arn → { username, password }
        │  3. read db_endpoint / db_port / db_name (non-secret outputs)
        ▼
   postgres://<user>:<pass>@<endpoint>:5432/rentflow?sslmode=require   (TLS enforced)
```

## Layer 8 — Compute (ECS Fargate + ALB)

`modules/compute` runs the RentFlow backend container. Consumes Foundation
(naming/tags/account), Networking (VPC + public/private-app subnets), and feeds
its ECS security group to the Database layer.

### ECS architecture / networking flow

```
   Internet
      │  :80 (:443 when certificate_arn set → HTTP redirects to HTTPS)
      ▼
   ┌─────────────────────── ALB (public subnets) ───────────────────────┐
   │  ALB SG: ingress 80/443 from 0.0.0.0/0                              │
   └───────────────┬────────────────────────────────────────────────────┘
                   │  target group (ip) :<container_port>
                   ▼
   ┌──────────── ECS Fargate service (PRIVATE app subnets) ─────────────┐
   │  ECS SG: ingress ONLY from ALB SG · assign_public_ip = false        │
   │  desired_count + CPU target-tracking autoscaling (min..max)         │
   │  deployment circuit breaker + rollback                              │
   └───────────────┬────────────────────────────────────────────────────┘
                   │  :5432 (ECS SG → DB SG)
                   ▼
             RDS PostgreSQL (private db subnets)
```

- Tasks are **never public** (`assign_public_ip = false`, private subnets, ingress
  only from the ALB).
- The ECS SG id is wired into `database.allowed_security_group_ids`, so only the
  backend can reach PostgreSQL.
- **Egress:** tasks reach ECR / Secrets Manager / CloudWatch / S3 privately via
  **VPC endpoints** (Layer 9) — no NAT Gateway, no public path. RDS is reached
  in-VPC via the DB security group.

### IAM model (least privilege)

| Role | Trust | Permissions |
| --- | --- | --- |
| Execution role | `ecs-tasks.amazonaws.com` + `aws:SourceAccount` | **only** `AmazonECSTaskExecutionRolePolicy` (ECR pull, log writes) |
| Task role | same | **none yet** — future scoped policies: `s3:*Object` on the storage bucket ARN, `secretsmanager:GetSecretValue` on the DB secret ARN |

No broad permissions, no inline `*` actions; the application's own permissions
are added later, each scoped to a specific ARN.

### Application image

`container_image` is always supplied by the caller (default is a **placeholder**
nginx image). The RentFlow backend image (ECR) and `container_port=3000` /
`health_check_path=/api/health` are set at deploy time — nothing is hardcoded.

## Layer 9 — Private AWS connectivity (VPC endpoints)

Extends `modules/networking`. Lets private ECS tasks use AWS services **without a
NAT Gateway or any public internet path**.

| Endpoint | Type | Purpose |
| --- | --- | --- |
| S3 | Gateway | object storage (attached to the private route tables; free) |
| ECR API + ECR DKR | Interface | pull the container image |
| CloudWatch Logs | Interface | `awslogs` driver |
| Secrets Manager | Interface | DB credentials |

- **Interface endpoints** get ENIs in the private app subnets with
  `private_dns_enabled = true`, so standard AWS SDK/DNS calls resolve to the
  private endpoint automatically — no app changes.
- **Endpoint security group** allows **443 only from the private app subnet
  CIDRs** (never `0.0.0.0/0`), egress denied. Referencing the compute ECS SG
  directly would create a networking↔compute cycle; the app-subnet CIDRs are the
  cycle-free, least-privilege equivalent (only the app tier lives there).

### ECS egress flow (no NAT)

```
  ECS task (private app subnet)
     │
     ├─ S3 .................→ S3 Gateway endpoint (via private route table)
     │
     └─ ECR / Logs / Secrets Manager
                ↓ private DNS → interface endpoint ENI (443, endpoint SG)
        ┌──────────────────────────────────────────────┐
        │  interface endpoints in private app subnets    │
        │  SG: 443 from app-subnet CIDRs only            │
        └──────────────────────────────────────────────┘
                ↓ AWS backbone (never traverses the internet)
             ECR / CloudWatch Logs / Secrets Manager
```

Result: image pulls, logging, secret reads, and S3 access all work with **no NAT
Gateway** and **no public egress**.

## Layer 10 — Container registry (ECR)

`modules/container_registry` holds the backend image in a private ECR repository
(`rentflow-<env>-backend`). Consumes Foundation only. **No IAM users, access
keys, or static credentials.**

### Container lifecycle

| Control | Setting |
| --- | --- |
| Visibility | private (account-scoped) |
| Scanning | `scan_on_push` (vulnerability scan every push) |
| Tags | `IMMUTABLE` (a deployed digest can't be silently replaced) |
| Encryption | AES256 (optional customer-managed KMS) |
| Cleanup | expire untagged after 14d; keep the last 10 images |

### Image flow (build → run)

```
  Developer / CI (OIDC, future)
        │ 1. docker build + tag <repo_url>:<sha>
        │ 2. docker push  (pushed image is scanned)
        ▼
  ECR: rentflow-<env>-backend   ── lifecycle: keep last 10, drop untagged ──►
        │ 3. set compute backend_container_image = <repo_url>:<sha>
        ▼
  ECS task (private app subnet)
        │ 4. pull via ECS EXECUTION ROLE (no creds) over the ECR VPC endpoints
        ▼               (Layer 8 role · Layer 9 endpoints — never public)
     running container
```

- Pulls need no static credentials: the ECS **execution role** (Layer 8)
  authenticates, and traffic stays private via the **ECR VPC endpoints** (Layer 9).
- CI/CD will push via **OIDC** to a role scoped to the repository ARN — no keys.
- `container_image` is wired at deploy time (root `backend_container_image`); the
  compute module is unchanged and there is no circular dependency
  (compute → container_registry → foundation).

## Layer 11 — CI/CD (GitHub Actions + OIDC)

`modules/cicd` lets GitHub Actions deploy the backend using **short-lived OIDC
tokens — no AWS access keys anywhere**. Consumes Foundation plus the ECR + ECS
ARNs; nothing depends on it (no cycle).

### OIDC security model

```
  GitHub Actions job (repo:<owner/repo>, branch:main)
        │  requests an OIDC id-token (permissions: id-token: write)
        ▼
  AWS STS AssumeRoleWithWebIdentity
        │  trust check on the deploy role:
        │    • Federated principal = GitHub OIDC provider
        │    • aud = sts.amazonaws.com
        │    • sub = repo:<owner/repo>:ref:refs/heads/main   ← repo + branch locked
        ▼
  Temporary credentials (minutes) — scoped to ECR push + ECS deploy only
```

- **No static credentials:** the workflow sets no `AWS_ACCESS_KEY_ID` /
  `AWS_SECRET_ACCESS_KEY`; it assumes the role via OIDC each run.
- **Explicit trust:** only the named repository + branch can assume the role.
- **Least privilege:** ECR push scoped to the repo ARN, ECS `UpdateService`/
  `DescribeServices` scoped to the service ARN, `iam:PassRole` limited to the two
  ECS roles (`PassedToService = ecs-tasks.amazonaws.com`). No admin, no wildcards
  beyond actions AWS can't scope (`GetAuthorizationToken`, `RegisterTaskDefinition`).

### Deployment process (`.github/workflows/backend-deploy.yml`)

```
 push to main (server/**)
   → checkout
   → configure-aws-credentials (OIDC → deploy role)
   → ECR login
   → docker build ./server, tag = git SHA   (tags are IMMUTABLE — SHA only)
   → docker push
   → describe current task definition → render with the new image
   → deploy task definition → update service → wait for stability
```

One-time setup: `tofu output github_deploy_role_arn` → set it as the GitHub repo
**variable** `AWS_DEPLOY_ROLE_ARN` (an ARN, not a secret). Then set the root
`github_repository` to the real `owner/repo` and re-apply the `cicd` module.

## Future dependency graph

```
                ┌────────────┐
                │ Foundation │  (naming, tags, validation)
                └─────┬──────┘
        name_prefix,  │  common_tags   (consumed by EVERY module)
        ┌─────────────┼───────────────────────────┬─────────────┐
        ▼             ▼                            ▼             ▼
  ┌───────────┐  ┌──────────┐                ┌──────────┐  ┌──────────┐
  │Networking │  │ identity │ (Cognito;      │ storage  │  │ (others) │
  │ vpc/subnet│  │  OIDC)   │  VPC-independent└──────────┘  └──────────┘
  └─────┬─────┘  └──────────┘
        │ vpc_id, subnet ids
        ├───────────────┬───────────────┐
        ▼               ▼               ▼
  ┌───────────┐   ┌───────────┐   ┌───────────┐
  │ security  │   │ database  │   │ compute   │
  │(flow logs;│   │ ✅ private │   │ ✅ ECS+ALB │
  │ SG later) │   │ RDS + SG  │   │ (private) │
  └───────────┘   └───────────┘   └─────┬─────┘
                        ▲               │ ecs_security_group_id
                        └───────────────┘ (opens app→db :5432)
```

- **networking** → `vpc_id`, subnet ids (consumed by security, database, compute)
- **security** → `vpc_id` (flow logs now; security groups later)
- **identity** → Foundation only; exposes OIDC `issuer_url` / `discovery_endpoint`
  for backend JWT validation and `user_pool_client_id` for the mobile apps
- **database** → `private_db_subnet_ids`, `vpc_id` ✅; ingress from `compute.ecs_security_group_id`
- **compute** → `private_app_subnet_ids`, `public_subnet_ids`, `vpc_id` ✅; ALB public, tasks private
- **storage** → VPC-independent; Foundation naming/tags
