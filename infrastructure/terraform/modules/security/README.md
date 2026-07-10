# Module: security

**Status:** implemented (Layer 4 — Security Baseline).

Establishes secure defaults before application services are added. This phase
provisions **VPC Flow Logs**; broader security primitives (KMS, Secrets Manager,
SSM, app IAM roles) are future work (see roadmap in `../../../ARCHITECTURE.md`).

Consumes Foundation (`name_prefix`, `common_tags`, `account_id`) and Networking
(`vpc_id`). Defines no names, tags, or regions of its own.

## Resources created (4)

| Resource | Purpose |
| --- | --- |
| `aws_cloudwatch_log_group` | Receives VPC flow logs; retention configurable (default 30d). |
| `aws_iam_role` | Assumable **only** by `vpc-flow-logs.amazonaws.com`, **only** from this account. |
| `aws_iam_role_policy` | Inline, least-privilege: write to the one log group only. |
| `aws_flow_log` | Captures `ALL` traffic for the VPC → CloudWatch Logs. |

**Not created:** KMS keys, Secrets Manager, SSM, Cognito, application IAM
users/roles, ECS roles, databases, buckets, WAF.

## Least-privilege IAM

- **Trust:** service principal `vpc-flow-logs.amazonaws.com` + `aws:SourceAccount`
  condition (confused-deputy guard).
- **Permissions:** `logs:CreateLogStream`, `logs:PutLogEvents`,
  `logs:DescribeLogStreams` — scoped to the flow-logs group ARN and its streams.
  No `CreateLogGroup` (the group is managed here), no `*` resources.

## Inputs

| Name | Default | Notes |
| --- | --- | --- |
| `name_prefix` | — | from `module.foundation.name_prefix` |
| `tags` | — | from `module.foundation.common_tags` |
| `vpc_id` | — | from `module.networking.vpc_id` |
| `aws_account_id` | — | from `module.foundation.account_id` (SourceAccount guard) |
| `flow_log_retention_days` | `30` | valid CloudWatch retention value |
| `flow_log_traffic_type` | `ALL` | `ACCEPT` / `REJECT` / `ALL` |
| `log_kms_key_arn` | `null` | optional CMK; null = default CW Logs encryption |

## Outputs

`flow_log_id`, `cloudwatch_log_group_name`, `cloudwatch_log_group_arn`,
`iam_role_arn`, `iam_role_name`.
