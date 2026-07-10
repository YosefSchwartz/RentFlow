# Module: networking

**Status:** implemented (Layer 3 — VPC/subnets/routing; Layer 9 — VPC endpoints).

The VPC foundation every compute/data layer sits inside. Consumes Foundation's
`name_prefix` + `common_tags`; defines no names or tags of its own.

## Resources created

| Resource | Count | Notes |
| --- | --- | --- |
| VPC | 1 | `10.0.0.0/16` (staging), DNS support + hostnames on |
| Internet Gateway | 1 | public egress/ingress |
| Public subnets | 2 | one per AZ, `map_public_ip_on_launch` |
| Private app subnets | 2 | one per AZ (ECS/Fargate, Lambda) |
| Private db subnets | 2 | one per AZ (RDS) |
| Public route table | 1 | default route → IGW |
| Private app route tables | 2 | per-AZ, local-only (NAT-ready) |
| Database route table | 1 | isolated, local-only (no internet, ever) |
| Route table associations | 6 | one per subnet |
| **VPC endpoints (Layer 9)** | 5 | S3 gateway + ECR API/DKR, Logs, Secrets Manager (interface) |
| Endpoint security group (+ ingress) | 1 (+2) | 443 from private app subnet CIDRs only |

**Not created:** NAT Gateway (replaced by VPC endpoints), application security
groups (owned by compute/database), and any compute/data/identity resources.

## Private AWS connectivity (Layer 9)

Private ECS tasks reach AWS services with **no NAT Gateway** and no public path
(see `endpoints.tf`):

- **S3** — Gateway endpoint on the private route tables (free).
- **ECR API / ECR DKR / CloudWatch Logs / Secrets Manager** — Interface
  endpoints (ENIs in the private app subnets), `private_dns_enabled = true`.
- **Endpoint SG** — HTTPS (443) only from the private app subnet CIDRs (never
  `0.0.0.0/0`; egress denied). Scoping to the app-subnet CIDRs — rather than the
  compute ECS SG — avoids a networking↔compute cycle while staying
  least-privilege (only the app tier lives in those subnets).

Extra outputs: `s3_gateway_endpoint_id`, `interface_endpoint_ids`,
`vpc_endpoint_security_group_id`.

## Subnet strategy (predictable, expandable)

`/24` subnets inside the `/16`, grouped by tier with a 16-block reserved range
each, so AZs/subnets can be added without renumbering:

| Tier | Offset | AZ-a | AZ-b | Reserved |
| --- | --- | --- | --- | --- |
| public | 0 | `10.0.0.0/24` | `10.0.1.0/24` | 0–15 |
| private-app | 16 | `10.0.16.0/24` | `10.0.17.0/24` | 16–31 |
| private-db | 32 | `10.0.32.0/24` | `10.0.33.0/24` | 32–47 |

CIDRs are computed with `cidrsubnet()`; AZs come from
`data.aws_availability_zones` (never hardcoded). Each environment uses a
distinct `/16` (staging `10.0.0.0/16`, production `10.1.0.0/16`) so future VPC
peering stays possible.

## Inputs

| Name | Default | Notes |
| --- | --- | --- |
| `name_prefix` | — | from `module.foundation.name_prefix` |
| `tags` | — | from `module.foundation.common_tags` |
| `vpc_cidr` | `10.0.0.0/16` | per-environment `/16` |
| `az_count` | `2` | 2 or 3 |
| `enable_dns_hostnames` | `true` | required for private RDS/VPC endpoints |

## Outputs

`vpc_id`, `vpc_cidr`, `availability_zones`, `public_subnet_ids`,
`private_app_subnet_ids`, `private_db_subnet_ids`, `public_route_table_id`,
`private_app_route_table_ids`, `database_route_table_id`.

## Consumed by (future)

- **database (RDS)** → `private_db_subnet_ids`, `vpc_id`
- **compute (ECS/Fargate)** → `private_app_subnet_ids`, `public_subnet_ids` (ALB)
- **storage** → `vpc_id` where VPC-scoped (identity/Cognito is VPC-independent)
