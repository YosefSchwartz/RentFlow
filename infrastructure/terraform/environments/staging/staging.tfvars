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

# --- Capacity (right-sized after the Jul 2026 FinOps review) ---
# Backend: measured Jul 9-22 at <0.3% avg CPU and <25% of 2 GB memory, so one
# 0.5 vCPU / 1 GB ARM64 (Graviton) task on FARGATE_SPOT carries staging.
# Load spikes are handled by autoscaling, not idle headroom: CPU (60%) and
# memory (75%) target tracking scale out to 8 tasks. The LibreOffice
# docx->PDF conversion is the memory-hungry path — if a SINGLE conversion
# OOMs a 1 GB task (scale-out adds tasks, it cannot grow one), raise
# backend_memory back to 2048 (valid pairing with cpu=512).
backend_cpu           = 512
backend_memory        = 1024
backend_desired_count = 1
backend_min_capacity  = 1
backend_max_capacity  = 8

# Database: back to micro (small was at 4% avg CPU / max 8 connections —
# unused headroom). Performance Insights stays on (free 7-day tier) to catch
# real pressure; storage autoscaling (20 -> 100 GB) is already enabled in the
# module, so the DB grows storage instead of crashing on a full disk.
db_instance_class               = "db.t4g.micro"
db_performance_insights_enabled = true

# --- Cost governance ---
# Post-FinOps-review run-rate is ~$70-90/mo; $100 gives alerting headroom
# without drowning real regressions. The email gets a one-time AWS
# confirmation message that must be accepted.
monthly_budget_limit = 100
billing_alert_email  = "yosef.sh05@gmail.com"

# AI platform (PR3). Off until Bedrock model access is granted for this account
# / region in the Bedrock console (an account setting, not IaC). Flip to true to
# enable; the task role then gets scoped bedrock:InvokeModel on the model below.
ai_enabled  = true
ai_provider = "bedrock"
ai_model_id = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
