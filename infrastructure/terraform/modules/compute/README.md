# Module: compute

**Status:** implemented (Layer 8 — Compute). ECS Fargate + ALB.

Runs the RentFlow backend as a container: public ALB → private Fargate tasks →
(future) RDS. Consumes Foundation (`name_prefix`, `common_tags`, `account_id`)
and Networking (`vpc_id`, `public_subnet_ids`, `private_app_subnet_ids`).

## Resources

| Resource | Notes |
| --- | --- |
| `aws_ecs_cluster` | Fargate; Container Insights (configurable) |
| `aws_lb` (+ target group, listeners) | public ALB in public subnets; HTTP:80, HTTPS-ready |
| `aws_ecs_task_definition` | Fargate awsvpc; configurable image/cpu/memory/port; awslogs |
| `aws_ecs_service` | private subnets, `assign_public_ip=false`, circuit breaker + rollback |
| `aws_appautoscaling_*` | CPU target-tracking, min/max capacity |
| IAM roles | execution role (managed policy only) + task role (no perms yet) |
| Security groups | ALB (public) + ECS (from ALB only) |
| `aws_cloudwatch_log_group` | container logs |

## Networking flow

```
Internet → ALB SG :80/:443 (public subnets) → ECS SG :<port> (private subnets) → RDS SG :5432
                                              assign_public_ip = false
```

ECS tasks are **never public**. Ingress to tasks is allowed only from the ALB
security group. The ECS SG id is output so the database module can allow it.

> **Prerequisite for a running service:** tasks in private subnets need outbound
> to pull the image (ECR) and reach Secrets Manager / RDS / CloudWatch. The
> networking layer deferred **NAT Gateway / VPC endpoints** — add one before the
> service can stabilize. Until then this layer plans/creates the topology but
> tasks cannot start.

## IAM model (least privilege)

- **Execution role** — trust: `ecs-tasks.amazonaws.com` + `aws:SourceAccount`.
  Permissions: the AWS managed `AmazonECSTaskExecutionRolePolicy` (ECR pull + log
  writes), **plus** — when `db_secret_arn` is set — an inline policy granting
  `secretsmanager:GetSecretValue` on **that one secret ARN** (no wildcards) so it
  can inject the DB credentials via the `secrets` block.
- **Task role** — same trust; **no permissions attached**. The app gets DB
  credentials via injected env and validates Cognito JWTs against a public JWKS,
  so it makes no direct AWS call. Future scoped policy (in `iam.tf`): `s3:*Object`
  on the storage bucket ARN when the app writes to S3.

## Runtime configuration

- `container_environment` (map) → plain `environment` entries.
- `container_secrets` (map name → `arn[:json-key::]`) → `secrets` entries,
  resolved at launch by the **execution** role (values never touch state/task def).
- `db_secret_arn` → scopes the execution role's `GetSecretValue` grant.
- `container_command` → optional command override (e.g. to compose `DATABASE_URL`
  from injected parts at start-up).

## Key inputs

| Name | Default | Notes |
| --- | --- | --- |
| `container_image` | `public.ecr.aws/nginx/nginx:stable` | **placeholder** — set the backend image |
| `container_port` | `3000` | RentFlow backend port |
| `cpu` / `memory` | `256` / `512` | valid Fargate pairing |
| `desired_count` | `2` | autoscaling manages afterwards |
| `min_capacity` / `max_capacity` | `2` / `6` | |
| `cpu_target_value` | `60` | target-tracking CPU % |
| `health_check_path` | `/` | set to the backend health route (e.g. `/api/health`) |
| `certificate_arn` | `null` | set to enable HTTPS + HTTP→HTTPS redirect |

## Outputs

`ecs_cluster_arn`, `ecs_cluster_name`, `ecs_service_name`, `alb_dns_name`,
`alb_arn`, `ecs_security_group_id`, `task_role_arn`, `execution_role_arn`.
