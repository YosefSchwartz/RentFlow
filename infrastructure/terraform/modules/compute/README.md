# Module: compute

**Status:** implemented (Layer 8 — Compute). ECS Fargate + ALB.

Runs the RentFlow backend as a container: public ALB → private Fargate tasks →
RDS PostgreSQL. Consumes Foundation (`name_prefix`, `common_tags`, `account_id`)
and Networking (`vpc_id`, `public_subnet_ids`, `private_app_subnet_ids`).

## Resources

| Resource | Notes |
| --- | --- |
| `aws_ecs_cluster` | Fargate; Container Insights (configurable) |
| `aws_lb` (+ target group, listeners) | public ALB in public subnets; HTTP:80, HTTPS-ready |
| `aws_ecs_task_definition` | Fargate awsvpc; configurable image/cpu/memory/port; awslogs |
| `aws_ecs_service` | private subnets, `assign_public_ip=false`, circuit breaker + rollback |
| `aws_appautoscaling_*` | CPU target-tracking, min/max capacity |
| IAM roles | execution role (managed policy + scoped Secrets Manager read) + task role (scoped S3 / SES / Bedrock / ECS Exec) |
| Security groups | ALB (public) + ECS (from ALB only) |
| `aws_cloudwatch_log_group` | container logs |

## Networking flow

```
Internet → ALB SG :80/:443 (public subnets) → ECS SG :<port> (private subnets) → RDS SG :5432
                                              assign_public_ip = false
```

ECS tasks are **never public**. Ingress to tasks is allowed only from the ALB
security group. The ECS SG id is output so the database module can allow it.

> **Private connectivity:** tasks in private subnets reach ECR (image pull),
> Secrets Manager, RDS, CloudWatch, and (when ECS Exec is enabled) SSM Messages
> over the **VPC endpoints** provided by the networking module (Layer 9) — there
> is no NAT Gateway and no public registry. The image must live in the private
> ECR repo. With the endpoints in place the service starts and stabilizes.

## IAM model (least privilege)

- **Execution role** — trust: `ecs-tasks.amazonaws.com` + `aws:SourceAccount`.
  Permissions: the AWS managed `AmazonECSTaskExecutionRolePolicy` (ECR pull + log
  writes), **plus** — when `db_secret_arn` and/or `app_secret_arns` are set — an
  inline policy granting `secretsmanager:GetSecretValue` on **exactly those secret
  ARNs** (no wildcards) so it can inject the DB password, JWT, and OTP secrets via
  the `secrets` block.
- **Task role** — same trust; the **application's own identity**. The app signs
  its OWN JWTs (HS256 with `JWT_SECRET`) and uses DB-backed refresh sessions, so
  it makes no AWS call for auth. It gets scoped, opt-in inline policies, each
  created only when its input is provided:
  - **`task_s3`** — `s3:GetObject/PutObject/DeleteObject` on `${s3_bucket_arn}/*`
    plus `s3:ListBucket` on the bucket (documents / media / attachments). Created
    only when `s3_bucket_arn` is set.
  - **`task_ses`** — `ses:SendEmail` / `ses:SendRawEmail` scoped to
    `ses_identity_arn` (OTP / verification / password-reset emails). Created only
    when `ses_identity_arn` is set.
  - **`task_bedrock`** — `bedrock:InvokeModel` +
    `bedrock:InvokeModelWithResponseStream` scoped to `bedrock_model_arns` (AI
    document analysis). Created only when the list is non-empty, so Bedrock is
    **fully opt-in**.
  - **`task_exec`** — `ssmmessages:*` (control/data channels) on `*` for ECS Exec.
    Created only when `enable_execute_command` is true.

## Runtime configuration

- `container_environment` (map) → plain `environment` entries (non-secret config).
- `container_secrets` (map name → `arn[:json-key::]`) → `secrets` entries,
  resolved at launch by the **execution** role (values never touch state/task def).
- `db_secret_arn` + `app_secret_arns` → scope the execution role's
  `GetSecretValue` grant to exactly those ARNs.
- `s3_bucket_arn` / `ses_identity_arn` / `bedrock_model_arns` → scope the task
  role's S3 / SES / Bedrock inline policies (each opt-in).
- `enable_execute_command` → enables ECS Exec on the service and grants the task
  role the SSM Messages permissions.
- `container_command` → optional command override (e.g. to compose `DATABASE_URL`
  from injected parts at start-up).

## Key inputs

| Name | Default | Notes |
| --- | --- | --- |
| `container_image` | `public.ecr.aws/nginx/nginx:stable` | placeholder default; staging sets the private-ECR backend image explicitly |
| `container_port` | `3000` | RentFlow backend port |
| `cpu` / `memory` | `256` / `512` | valid Fargate pairing |
| `desired_count` | `2` | autoscaling manages afterwards |
| `min_capacity` / `max_capacity` | `2` / `6` | |
| `cpu_target_value` | `60` | target-tracking CPU % |
| `container_environment` | `{}` | non-secret env vars (name → value) |
| `container_secrets` | `{}` | secret env vars (name → Secrets Manager `valueFrom`) |
| `container_command` | `null` | optional command override (e.g. compose `DATABASE_URL`) |
| `db_secret_arn` | `null` | RDS secret ARN the execution role may read |
| `app_secret_arns` | `[]` | extra secret ARNs the execution role may read (JWT, OTP) |
| `s3_bucket_arn` | `null` | bucket the task role may read/write (opt-in S3 policy) |
| `ses_identity_arn` | `null` | verified SES identity the task role may send from (opt-in) |
| `bedrock_model_arns` | `[]` | Bedrock model/profile ARNs the task role may invoke (opt-in) |
| `enable_execute_command` | `false` | enable ECS Exec + grant task role SSM Messages |
| `health_check_path` | `/` | set to the backend health route (e.g. `/api/health`) |
| `certificate_arn` | `null` | set to enable HTTPS + HTTP→HTTPS redirect |

## Outputs

`ecs_cluster_arn`, `ecs_cluster_name`, `ecs_service_name`, `alb_dns_name`,
`alb_arn`, `ecs_security_group_id`, `task_role_arn`, `execution_role_arn`.
