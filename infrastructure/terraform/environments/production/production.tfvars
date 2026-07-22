# Production environment values.
# PLACEHOLDER — production is not provisioned yet. Structure is in place so that
# standing up production is a fill-in-the-values exercise, not a refactor.

environment = "production"
aws_region  = "eu-central-1"
aws_profile = "rentflow-production"
# TODO: set to the real production account id when the production account exists.
aws_account_id = "000000000000"
# Distinct /16 from staging (10.0.0.0/16) so future VPC peering stays possible.
vpc_cidr = "10.1.0.0/16"

additional_tags = {
  CostCenter = "rentflow-production"
}

# Database — production-grade defaults (HA + longer backups + PI).
db_instance_class               = "db.r6g.large"
db_multi_az                     = true
db_backup_retention_days        = 30
db_performance_insights_enabled = true

# Compute — larger baseline + wider autoscaling for production.
backend_cpu           = 512
backend_memory        = 1024
backend_desired_count = 3
backend_min_capacity  = 3
backend_max_capacity  = 12

# AI platform (PR3). Off until Bedrock model access is granted for this account
# / region (a Bedrock console account setting, not IaC).
ai_enabled  = false
ai_provider = "bedrock"
ai_model_id = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
