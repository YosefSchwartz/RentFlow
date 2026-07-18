# ============================================================================
# Database (Layer 7) — Amazon RDS PostgreSQL (private, encrypted).
# ============================================================================
# Stores RentFlow relational data. Runs in private DB subnets only, no public
# access, encrypted at rest, TLS enforced, with automated backups and deletion
# protection.
#
# The master password is deliberately self-managed (manage_master_user_password
# = false), NOT RDS-managed. RDS-managed passwords auto-rotate on a schedule
# (observed ~7 days), and since the app builds its DATABASE_URL once at
# container startup, a rotation silently breaks already-running tasks until
# they're redeployed. The caller (environment root) generates the password
# with `random_password` and stores it in Secrets Manager itself, mirroring
# JWT_SECRET/OTP_SECRET — same trade-off already accepted for those, applied
# consistently here. Passed in via var.master_password (sensitive).
# ----------------------------------------------------------------------------

locals {
  port          = 5432
  engine_major  = split(".", var.engine_version)[0]
  family        = "postgres${local.engine_major}"
  instance_name = "${var.name_prefix}-db"
}

resource "aws_db_subnet_group" "this" {
  name       = local.instance_name
  subnet_ids = var.subnet_ids

  tags = merge(var.tags, { Name = local.instance_name })
}

# Parameter group: require TLS for all client connections.
resource "aws_db_parameter_group" "this" {
  name   = "${local.instance_name}-pg"
  family = local.family

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = merge(var.tags, { Name = "${local.instance_name}-pg" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "this" {
  identifier     = local.instance_name
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  # --- Storage (encrypted, autoscaling) ---
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = var.storage_type
  storage_encrypted     = true
  kms_key_id            = var.kms_key_arn # null = AWS-managed key

  # --- Database + credentials (self-managed; see header comment) ---
  # manage_master_user_password is deliberately OMITTED, not set to false —
  # the AWS provider treats "password" and "manage_master_user_password" as
  # ConflictsWith at the configuration level (present vs. absent), not just by
  # value, so writing `= false` alongside `password` fails validation.
  db_name  = var.database_name
  username = var.master_username
  password = var.master_password
  port     = local.port

  # --- Networking: private only ---
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = var.publicly_accessible

  # --- Availability + backups + protection ---
  multi_az                  = var.multi_az
  backup_retention_period   = var.backup_retention_period
  copy_tags_to_snapshot     = true
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${local.instance_name}-final"

  # --- Observability ---
  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_enabled ? var.performance_insights_retention_period : null
  performance_insights_kms_key_id       = var.performance_insights_enabled ? var.kms_key_arn : null
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]

  # --- Maintenance ---
  parameter_group_name       = aws_db_parameter_group.this.name
  auto_minor_version_upgrade = true
  apply_immediately          = var.apply_immediately

  tags = merge(var.tags, { Name = local.instance_name })
}
