# Module: database

**Status:** implemented (Layer 7 — Database). Amazon RDS PostgreSQL.

Managed PostgreSQL for the NestJS/Prisma backend's relational data. Consumes
Foundation (`name_prefix`, `common_tags`) and Networking (`vpc_id`,
`private_db_subnet_ids`). Private-only, encrypted, credentials in Secrets
Manager. Creates **no plaintext passwords, no credentials in code/state**.

## Resources created

| Resource | Notes |
| --- | --- |
| `aws_db_subnet_group` | across the private **database** subnets (2 AZs) |
| `aws_security_group` (+ ingress rules) | PostgreSQL 5432 from allowed SGs/CIDRs only; deny-all egress |
| `aws_db_parameter_group` | `rds.force_ssl = 1` (TLS required) |
| `aws_db_instance` | PostgreSQL, private, encrypted, backups, deletion protection |

## Security posture

- **Private only** — `publicly_accessible = false`, in private DB subnets with a
  DB subnet group; no route to the internet.
- **No broad ingress** — port 5432 reachable **only** from
  `allowed_security_group_ids` / `allowed_cidr_blocks` (both empty by default, so
  the DB is unreachable until the backend SG is wired in). `0.0.0.0/0` is
  rejected by validation.
- **Deny-all egress** — RDS-managed features don't need instance-SG egress;
  client return traffic is auto-allowed (stateful SG).
- **TLS enforced** — `rds.force_ssl = 1`.
- **Encrypted at rest** — `storage_encrypted = true`; optional customer-managed
  KMS via `kms_key_arn` (also encrypts the secret + Performance Insights).

## Credentials — Secrets Manager, never in state

Uses **`manage_master_user_password = false`**: RDS generates the master password,
stores it in a Secrets Manager secret, and manages rotation. The password never
appears in Terraform variables, state, or this repo. Consumers read the secret
via `secret_arn` (grant `secretsmanager:GetSecretValue` on that ARN only).

## Production readiness (configurable)

| Input | Staging default | Production suggestion |
| --- | --- | --- |
| `instance_class` | `db.t4g.micro` | `db.r6g.large`+ |
| `multi_az` | `false` | `true` |
| `backup_retention_period` | `7` | `30` |
| `performance_insights_enabled` | `false` | `true` |
| `deletion_protection` | `true` | `true` |
| `skip_final_snapshot` | `false` | `false` |

Storage autoscales to `max_allocated_storage`; `enabled_cloudwatch_logs_exports`
ships PostgreSQL logs to CloudWatch.

## Outputs

`db_endpoint`, `db_port`, `db_name`, `security_group_id`, `secret_arn`,
`db_instance_identifier`, `db_instance_arn`. **No password.**

## Future backend integration

1. Backend/compute layer creates an app security group.
2. Pass it as `allowed_security_group_ids` here → opens 5432 from the app only.
3. Backend reads `secret_arn` for username/password and `db_endpoint`/`db_port`/
   `db_name` for the rest of the DSN; connects over TLS (`sslmode=require`).
