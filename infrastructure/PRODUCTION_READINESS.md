# RentFlow — Production Readiness

Checklist for the RentFlow AWS platform ahead of the **first real deployment**
(staging). Status legend:

- ✅ **Complete** — implemented, validated, production-grade.
- 🟡 **Pending** — implemented but needs an action/decision, or not yet built.
- ⛔ **Blocked** — cannot proceed until an out-of-scope dependency exists.

> Scope note: this phase hardened the existing platform only. Monitoring, HTTPS,
> DNS, and the Production account are intentionally **not** implemented yet.

| # | Area | Status | Notes |
| --- | --- | --- | --- |
| 1 | **Bootstrap** | ✅ Complete | Remote state S3 bucket `rentflow-tfstate-304126178791` + DynamoDB lock `rentflow-tf-lock`, encrypted, versioned, TLS-only. |
| 2 | **Networking** | ✅ Complete | VPC `10.0.0.0/16`, public + private-app + private-db subnets across 2 AZs, per-AZ route tables, IGW. No NAT (endpoints instead). |
| 3 | **Security (baseline)** | ✅ Complete | VPC Flow Logs → CloudWatch, least-privilege role. KMS CMKs, GuardDuty/Config/WAF = 🟡 future. |
| 4 | **Identity** | ✅ Complete | Cognito user pool + mobile client (SRP, MFA optional, threat protection). App migration off app-JWT = 🟡 future. |
| 5 | **Storage** | ✅ Complete | Private S3 bucket, versioned, encrypted, TLS-only, lifecycle, ACLs disabled. |
| 6 | **Database** | ✅ Complete | RDS PostgreSQL private, encrypted, TLS-forced, deletion protection, RDS-managed secret. |
| 7 | **Compute** | 🟡 Pending | ECS Fargate + ALB + autoscaling implemented. Needs at deploy: real image, ALB `health_check_path=/api/health`, task-role permissions. |
| 8 | **Container Registry** | ✅ Complete | Private ECR, scan-on-push, immutable tags, encrypted, lifecycle. |
| 9 | **CI/CD** | 🟡 Pending | OIDC deploy role + workflow implemented. Needs: set `github_repository`, publish `AWS_DEPLOY_ROLE_ARN` repo variable. |
| 10 | **Monitoring** | 🟡 Pending | Not implemented (out of scope). CloudWatch dashboards/Container Insights alarms deferred. |
| 11 | **HTTPS** | 🟡 Pending | ALB is HTTP-only today; module is HTTPS-ready via `certificate_arn`. Needs ACM cert (out of scope). |
| 12 | **DNS** | 🟡 Pending | No Route 53 zone/records yet (out of scope). Clients use the ALB DNS name. |
| 13 | **Backups** | ✅ Complete | RDS automated backups (7d staging / 30d prod), final snapshot on destroy, S3 versioning. Cross-region copy = 🟡 future. |
| 14 | **Disaster Recovery** | 🟡 Pending | Single-region. No cross-region snapshot copy, no documented restore runbook, no RTO/RPO targets. |
| 15 | **Production Account** | ⛔ Blocked | Production account not created; `production.tfvars` uses a placeholder account id. Out of scope this phase. |
| 16 | **Cost Review** | 🟡 Pending | Per-layer cost notes documented (VPC endpoints ~$29/mo, RDS, ECS). No AWS Budgets / Cost Anomaly Detection yet (monitoring, out of scope). |
| 17 | **Secrets** | 🟡 Pending | DB credentials in Secrets Manager (no static creds anywhere). App secrets (JWT, etc.) not yet injected into ECS; task role lacks `GetSecretValue` (documented placeholder). |
| 18 | **Logging** | ✅ Complete | VPC flow logs, ECS container logs, and RDS logs all ship to CloudWatch with retention. Log-based alerting = 🟡 (see Alerting). |
| 19 | **Alerting** | 🟡 Pending | No CloudWatch alarms / SNS notifications yet (monitoring, out of scope). |

## Application / deployment hardening (this phase)

| Item | Status | Notes |
| --- | --- | --- |
| Backend Docker image | ✅ Complete | Multi-stage, non-root, `dumb-init` PID 1, `NODE_ENV=production`, HEALTHCHECK, Prisma client copied from builder (pinned, no network fetch), debug commands removed. |
| Health endpoint | ✅ Complete | `GET /api/health` (unauthenticated liveness) for HEALTHCHECK + ALB. |
| GitHub Actions workflow | ✅ Complete | OIDC only (no static creds), immutable SHA tags, correct `./keynest` build context, ECR login, describe→render→deploy→wait. |
| Terraform hygiene | ✅ Complete | `fmt` clean, both envs `validate`, no duplicated providers/locals/tags, no broken refs, no dead/obsolete modules. |

## Remaining blockers before the first real (staging) deployment

1. **Backend image** — build + push the real image to ECR; set `backend_container_image` (placeholder is nginx).
2. **ALB health check path** — set compute `health_check_path = "/api/health"` (default `/` matches only the nginx placeholder).
3. **ECS task-role permissions** — grant `secretsmanager:GetSecretValue` on the DB secret ARN and S3 access on the storage bucket ARN; inject DB DSN (`sslmode=require`) + `JWT_SECRET`.
4. **CI/CD wiring** — set `github_repository` to the real `owner/repo`; publish `AWS_DEPLOY_ROLE_ARN` as a repo variable from `tofu output`.
5. **Apply order** — bootstrap (done) → `tofu apply` the staging root (networking → security → identity → storage → database → compute → registry → cicd) under `--profile rentflow-staging`.

Not blockers for a first **staging** bring-up, but required before production:
HTTPS (ACM), DNS (Route 53), Monitoring + Alerting, DR runbook, and the
Production account.
