# Staging environment — OpenTofu root module.
#
# Backend settings (bucket, key, region, dynamodb_table, encrypt, profile) are
# supplied at init time from backend.hcl and are NEVER hardcoded here:
#
#   tofu init -backend-config=backend.hcl
#
# This root is intentionally thin: it configures the provider and calls the
# shared Foundation module. All naming/tagging/validation logic lives in
# ../../modules/foundation, so nothing is duplicated between environments.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {}
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

# Layer 2 — Foundation. Creates no resources; provides naming, tags, and
# account/region/environment validation. Its outputs feed all future modules.
module "foundation" {
  source = "../../modules/foundation"

  environment     = var.environment
  aws_region      = var.aws_region
  aws_account_id  = var.aws_account_id
  additional_tags = var.additional_tags
}

# Layer 3 — Networking. VPC + subnets + routing. Consumes Foundation naming/tags.
module "networking" {
  source = "../../modules/networking"

  name_prefix = module.foundation.name_prefix
  tags        = module.foundation.common_tags
  vpc_cidr    = var.vpc_cidr

  # ssmmessages interface endpoint so ECS Exec can reach SSM from the private
  # app subnets (no NAT). Required by compute's enable_execute_command below.
  additional_interface_endpoints = {
    ssmmessages = "ssmmessages"
  }

  # TEMPORARY: internet route on the DB route table for IP-restricted DataGrip
  # access to RDS. Reachability is still gated by the DB SG (/32). Set back to
  # false (with publicly_accessible=false) to re-isolate the database.
  enable_db_internet_route = true
}

# Layer 4 — Security baseline. VPC flow logs → CloudWatch (least-privilege role).
module "security" {
  source = "../../modules/security"

  name_prefix             = module.foundation.name_prefix
  tags                    = module.foundation.common_tags
  aws_account_id          = module.foundation.account_id
  vpc_id                  = module.networking.vpc_id
  flow_log_retention_days = var.flow_log_retention_days
}

# Layer 5 — Identity. Cognito user pool + mobile client. Consumes Foundation.
module "identity" {
  source = "../../modules/identity"

  name_prefix = module.foundation.name_prefix
  tags        = module.foundation.common_tags
}

# Layer 6 — Storage. Secure private S3 bucket for application data.
module "storage" {
  source = "../../modules/storage"

  name_prefix = module.foundation.name_prefix
  tags        = module.foundation.common_tags
}

# Layer 7 — Database. Private RDS PostgreSQL (credentials in Secrets Manager).
module "database" {
  source = "../../modules/database"

  name_prefix = module.foundation.name_prefix
  tags        = module.foundation.common_tags

  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.private_db_subnet_ids
  # TEMPORARY developer access: the instance already has a public IP
  # (publicly_accessible=true); the DB route table is given an internet route
  # below (networking enable_db_internet_route) so that IP is reachable, without
  # relocating the running instance. Reachability is still gated by the /32 SG
  # rule. Revert publicly_accessible=false + enable_db_internet_route=false to
  # re-isolate the DB.
  publicly_accessible = true

  instance_class               = var.db_instance_class
  multi_az                     = var.db_multi_az
  backup_retention_period      = var.db_backup_retention_days
  performance_insights_enabled = var.db_performance_insights_enabled

  master_password = random_password.db_master.result

  # Open PostgreSQL to the backend tasks only (Layer 8)...
  allowed_security_group_ids = [module.compute.ecs_security_group_id]
  # ...plus a single developer laptop for DataGrip. NOT 0.0.0.0/0 (the module
  # validation forbids it). Update this /32 when your ISP-assigned IP changes.
  allowed_cidr_blocks = ["5.29.8.73/32"]
}

# --- Application secrets (backend runtime) ---
# Database master user password. Self-managed (NOT RDS-managed rotation — see
# modules/database/main.tf header for why) — generated here and stored in
# Secrets Manager, same pattern as jwt_secret/otp_secret below.
resource "random_password" "db_master" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db_master" {
  name        = "${module.foundation.name_prefix}-db-master-password"
  description = "RDS master user password (self-managed — no automatic rotation)."
  tags        = module.foundation.common_tags
}

resource "aws_secretsmanager_secret_version" "db_master" {
  secret_id     = aws_secretsmanager_secret.db_master.id
  secret_string = random_password.db_master.result
}

# JWT signing secret for the backend. Generated here (never committed, never
# passed as a tfvar) and stored in Secrets Manager, then injected into the ECS
# task via the `secrets` block — the value never appears in the task definition
# or in describe-task-definition output. Rotating it only invalidates the
# outstanding 15-minute access tokens; DB-backed refresh sessions survive.
resource "random_password" "jwt_secret" {
  length  = 48
  special = false # base62 — safe in any header/env without escaping
}

resource "aws_secretsmanager_secret" "jwt" {
  name        = "${module.foundation.name_prefix}-jwt-secret"
  description = "Backend JWT signing secret (HS256 access tokens)."
  tags        = module.foundation.common_tags
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt_secret.result
}

# OTP hashing secret (HMAC-SHA256 of email-verification / password-reset
# codes). Deliberately separate from JWT_SECRET — rotating one never
# invalidates the other. Same generate/store/inject pattern as jwt_secret
# above.
resource "random_password" "otp_secret" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "otp" {
  name        = "${module.foundation.name_prefix}-otp-secret"
  description = "Backend OTP hashing secret (HMAC-SHA256 email verification / password reset codes)."
  tags        = module.foundation.common_tags
}

resource "aws_secretsmanager_secret_version" "otp" {
  secret_id     = aws_secretsmanager_secret.otp.id
  secret_string = random_password.otp_secret.result
}

# Layer 9 — Notifications. SES for transactional OTP email. No dependency on
# compute; compute depends on its ses_identity_arn output below (same shape
# as the existing compute -> container_registry dependency).
module "notifications" {
  source = "../../modules/notifications"

  name_prefix      = module.foundation.name_prefix
  tags             = module.foundation.common_tags
  ses_sender_email = var.ses_sender_email
}

# Layer 10 — Container registry. Private ECR repo for the backend image.
module "container_registry" {
  source = "../../modules/container_registry"

  name_prefix = module.foundation.name_prefix
  tags        = module.foundation.common_tags
}

# Layer 8 — Compute. ECS Fargate backend behind a public ALB. Private tasks.
# The image comes from the PRIVATE ECR repo (rentflow-staging-backend), pulled
# over the Layer 9 ECR/S3 VPC endpoints — no NAT, no public registry. Build and
# push a SHA-tagged image first, then apply with -var "backend_image_tag=<sha>".
# (No cycle: compute → container_registry → foundation.)
module "compute" {
  source = "../../modules/compute"

  name_prefix    = module.foundation.name_prefix
  tags           = module.foundation.common_tags
  aws_account_id = module.foundation.account_id

  vpc_id                 = module.networking.vpc_id
  public_subnet_ids      = module.networking.public_subnet_ids
  private_app_subnet_ids = module.networking.private_app_subnet_ids

  container_image   = "${module.container_registry.repository_url}:${var.backend_image_tag}"
  container_port    = 3000
  health_check_path = "/api/health"

  # ECS Exec for interactive debugging (aws ecs execute-command). Needs the
  # ssmmessages endpoint wired into the networking module above.
  enable_execute_command = true
  cpu                    = var.backend_cpu
  memory                 = var.backend_memory
  desired_count          = var.backend_desired_count
  min_capacity           = var.backend_min_capacity
  max_capacity           = var.backend_max_capacity

  # --- Runtime configuration ---
  # Non-secret config as plain env vars. (The backend signs its OWN JWTs with
  # JWT_SECRET and uses DB-backed sessions — it does NOT use Cognito — so no
  # COGNITO_* vars are injected here.)
  container_environment = {
    NODE_ENV       = "production"
    PORT           = "3000"
    AWS_REGION     = var.aws_region
    S3_BUCKET_NAME = module.storage.bucket_name

    # Non-secret DB connection parts (used to compose DATABASE_URL below).
    # Username isn't a secret (it's a known, non-sensitive value) — only the
    # password needs Secrets Manager.
    DB_HOST     = module.database.db_endpoint
    DB_PORT     = tostring(module.database.db_port)
    DB_NAME     = module.database.db_name
    DB_USERNAME = module.database.master_username

    # OTP email delivery. Sender address and region aren't secrets. Start on
    # "console" (logs instead of sending) until the SES identity's
    # confirmation link has been clicked (see modules/notifications/README.md),
    # then flip to "ses" in a follow-up deploy.
    EMAIL_PROVIDER   = "ses"
    SES_SENDER_EMAIL = module.notifications.sender_email
  }

  # Secrets are resolved by the ECS agent at launch (execution role) and never
  # appear in the task definition or state:
  #   * DB_PASSWORD     — our generated Secrets Manager secret (plain string;
  #                       self-managed, not RDS-managed — see modules/database).
  #   * JWT_SECRET      — our generated Secrets Manager secret (plain string).
  #   * OTP_SECRET      — our generated Secrets Manager secret (plain string).
  container_secrets = {
    DB_PASSWORD = aws_secretsmanager_secret.db_master.arn
    JWT_SECRET  = aws_secretsmanager_secret.jwt.arn
    OTP_SECRET  = aws_secretsmanager_secret.otp.arn
  }
  db_secret_arn   = aws_secretsmanager_secret.db_master.arn
  app_secret_arns = [aws_secretsmanager_secret.jwt.arn, aws_secretsmanager_secret.otp.arn]

  # Least-privilege S3 access for the task role (documents / media / attachments).
  s3_bucket_arn = module.storage.bucket_arn
  # Least-privilege SES send access for the task role (OTP emails), scoped to
  # the one verified sender identity.
  ses_identity_arn = module.notifications.ses_identity_arn

  # Compose DATABASE_URL at container start from the injected parts. The
  # password is URL-encoded via node so any special character is safe. The
  # password only ever exists in the container's memory, not in state/task def.
  container_command = [
    "/bin/sh", "-c",
    "export DATABASE_URL=\"postgresql://$DB_USERNAME:$(node -e 'process.stdout.write(encodeURIComponent(process.env.DB_PASSWORD))')@$DB_HOST:$DB_PORT/$DB_NAME?schema=public&sslmode=require\"; exec node dist/src/main.js"
  ]
}

# Layer 11 — CI/CD. GitHub Actions → AWS via OIDC (no static credentials).
module "cicd" {
  source = "../../modules/cicd"

  name_prefix = module.foundation.name_prefix
  tags        = module.foundation.common_tags

  github_repository = var.github_repository
  github_branch     = var.github_branch

  ecr_repository_arn     = module.container_registry.repository_arn
  ecs_service_arn        = module.compute.ecs_service_arn
  ecs_execution_role_arn = module.compute.execution_role_arn
  ecs_task_role_arn      = module.compute.task_role_arn
}
