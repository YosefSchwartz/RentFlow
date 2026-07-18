# Production environment — OpenTofu root module.
#
# Backend settings (bucket, key, region, dynamodb_table, encrypt, profile) are
# supplied at init time from backend.hcl and are NEVER hardcoded here:
#
#   tofu init -backend-config=backend.hcl
#
# Backend prepared; no resources yet. This root mirrors staging: it configures
# the provider and calls the shared Foundation module. All naming/tagging/
# validation logic lives in ../../modules/foundation (never duplicated).

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

  instance_class               = var.db_instance_class
  multi_az                     = var.db_multi_az
  backup_retention_period      = var.db_backup_retention_days
  performance_insights_enabled = var.db_performance_insights_enabled

  master_password = random_password.db_master.result

  # Open PostgreSQL to the backend tasks only (Layer 8).
  allowed_security_group_ids = [module.compute.ecs_security_group_id]
}

# --- Application secrets (backend runtime) ---
# Database master user password. Self-managed (NOT RDS-managed rotation — see
# modules/database/main.tf header for why) — generated here and stored in
# Secrets Manager, same pattern as jwt_secret below. (Mirrors staging.)
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

# JWT signing secret — generated here, stored in Secrets Manager, injected into
# the ECS task via the `secrets` block. Never committed, never a tfvar, never
# in the task definition. (Mirrors staging.)
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

# Layer 10 — Container registry. Private ECR repo for the backend image.
module "container_registry" {
  source = "../../modules/container_registry"

  name_prefix = module.foundation.name_prefix
  tags        = module.foundation.common_tags
}

# Layer 8 — Compute. ECS Fargate backend behind a public ALB. Private tasks.
# Image comes from the private ECR repo, pulled over the Layer 9 VPC endpoints
# (no NAT). Build + push a SHA tag first, then apply with -var "backend_image_tag=<sha>".
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
  cpu               = var.backend_cpu
  memory            = var.backend_memory
  desired_count     = var.backend_desired_count
  min_capacity      = var.backend_min_capacity
  max_capacity      = var.backend_max_capacity

  # --- Runtime configuration (mirrors staging) ---
  # Backend signs its own JWTs + uses DB-backed sessions (no Cognito).
  container_environment = {
    NODE_ENV       = "production"
    PORT           = "3000"
    AWS_REGION     = var.aws_region
    S3_BUCKET_NAME = module.storage.bucket_name

    DB_HOST     = module.database.db_endpoint
    DB_PORT     = tostring(module.database.db_port)
    DB_NAME     = module.database.db_name
    DB_USERNAME = module.database.master_username
  }

  # Resolved by the ECS agent at launch (execution role); never in state/task def.
  container_secrets = {
    DB_PASSWORD = aws_secretsmanager_secret.db_master.arn
    JWT_SECRET  = aws_secretsmanager_secret.jwt.arn
  }
  db_secret_arn   = aws_secretsmanager_secret.db_master.arn
  app_secret_arns = [aws_secretsmanager_secret.jwt.arn]

  s3_bucket_arn = module.storage.bucket_arn

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
