# Staging environment values.
# Supplied at plan/apply time:  tofu plan -var-file=environments/staging/staging.tfvars
#
# Only environment-varying inputs belong here.

environment    = "staging"
aws_region     = "eu-central-1"
aws_profile    = "rentflow-staging"
aws_account_id = "304126178791"
vpc_cidr       = "10.0.0.0/16"

additional_tags = {
  CostCenter = "rentflow-staging"
}

# --- Capacity (scaling up ahead of real users) ---
# Backend: 1 vCPU / 2 GB per task — headroom for real traffic and for the
# LibreOffice docx->PDF conversion in the AI pipeline (memory-hungry). Valid
# Fargate CPU/memory pairing. HA stays at 2 tasks across 2 AZs; autoscale to 8.
backend_cpu           = 1024
backend_memory        = 2048
backend_desired_count = 2
backend_min_capacity  = 2
backend_max_capacity  = 8

# Database: bump micro (1 GB) -> small (2 GB) for real-user load, and turn on
# Performance Insights (free 7-day tier) to watch DB load. Storage autoscaling
# (20 -> 100 GB) is already enabled in the module.
db_instance_class               = "db.t4g.small"
db_performance_insights_enabled = true

# AI platform (PR3). Off until Bedrock model access is granted for this account
# / region in the Bedrock console (an account setting, not IaC). Flip to true to
# enable; the task role then gets scoped bedrock:InvokeModel on the model below.
ai_enabled  = true
ai_provider = "bedrock"
ai_model_id = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
