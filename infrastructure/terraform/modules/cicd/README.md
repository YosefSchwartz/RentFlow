# Module: cicd

**Status:** implemented (Layer 11 — CI/CD). GitHub Actions ↔ AWS via OIDC.

Lets GitHub Actions authenticate to AWS with short-lived **OIDC** tokens and
deploy the backend. Consumes Foundation (`name_prefix`, `common_tags`) plus the
ECR + ECS ARNs. Creates **no IAM users, no access keys, no long-lived
credentials**.

## Resources created

| Resource | Notes |
| --- | --- |
| `aws_iam_openid_connect_provider` | GitHub OIDC (one per account; can reuse an existing one) |
| `aws_iam_role` | deploy role, assumable only via OIDC by the named repo+branch |
| `aws_iam_role_policy` | least-privilege ECR push + ECS deploy |

## OIDC trust (explicit)

- Federated principal: the GitHub OIDC provider.
- `aud = sts.amazonaws.com`.
- `sub` restricted to `repo:<github_repository>:ref:refs/heads/<github_branch>`
  — only that repository + branch can assume the role.

The thumbprint is derived at plan time from GitHub's OIDC certificate
(`data.tls_certificate`), so nothing is hardcoded. One OIDC provider exists per
account — set `create_oidc_provider = false` + `existing_oidc_provider_arn` if
the account already has one.

## Deploy permissions (least privilege)

| Area | Actions | Scope |
| --- | --- | --- |
| ECR auth | `GetAuthorizationToken` | `*` (no resource-level support) |
| ECR push | layer upload + `PutImage` + describe | the backend repo ARN only |
| ECS register | `RegisterTaskDefinition`, `DescribeTaskDefinition` | `*` (no resource-level support) |
| ECS deploy | `UpdateService`, `DescribeServices` | the backend service ARN only |
| PassRole | `iam:PassRole` | exec + task role ARNs only, `iam:PassedToService = ecs-tasks.amazonaws.com` |

No `AdministratorAccess`, no wildcard admin, no CloudWatch (rollout wait uses
`DescribeServices`).

## Inputs

`name_prefix`, `tags`, `github_repository`, `github_branch` (default `main`),
`create_oidc_provider` (default `true`), `existing_oidc_provider_arn`,
`ecr_repository_arn`, `ecs_service_arn`, `ecs_execution_role_arn`,
`ecs_task_role_arn`.

## Outputs

`deploy_role_arn` (set as the GitHub repo variable `AWS_DEPLOY_ROLE_ARN`),
`oidc_provider_arn`.

## Dependency direction

`cicd → container_registry`, `cicd → compute` (one-way). Nothing depends on
`cicd`, so there is no circular dependency.
