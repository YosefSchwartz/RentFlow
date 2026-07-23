# Staging root — inputs (values in staging.tfvars).
#
# These are the root's thin interface: provider settings + values passed
# straight through to the Foundation module. Validation and defaults live in
# the Foundation module, so they are defined once, not duplicated here.

variable "aws_region" {
  type = string
}

variable "aws_profile" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_account_id" {
  type = string
}

variable "additional_tags" {
  type    = map(string)
  default = {}
}

variable "vpc_cidr" {
  type = string
}

variable "flow_log_retention_days" {
  type    = number
  default = 30
}

# --- Database (Layer 7) ---
variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_backup_retention_days" {
  type    = number
  default = 7
}

variable "db_performance_insights_enabled" {
  type    = bool
  default = false
}

# --- Compute (Layer 8) ---
# Image tag (git SHA) to deploy from the private ECR repo. No default: it must
# be a tag that has already been built and pushed. Pass at apply time, e.g.
#   tofu apply -var-file=environments/staging/staging.tfvars -var "backend_image_tag=$(git rev-parse --short HEAD)"
variable "backend_image_tag" {
  type = string
}

# --- AI document intelligence platform (PR3) ---
# Feature flag + provider selection + model. Bedrock needs no secret (task-role
# IAM). Kept off by default until Bedrock model access is granted in-account.
variable "ai_enabled" {
  description = "Enable background AI document analysis."
  type        = bool
  default     = false
}

variable "ai_provider" {
  description = "AI provider: \"bedrock\" or \"mock\"."
  type        = string
  default     = "bedrock"
}

variable "ai_model_id" {
  description = "Bedrock model or cross-region inference-profile id (e.g. eu.anthropic.*) used when ai_provider = bedrock."
  type        = string
  default     = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
}

# NOTE: the JWT signing secret is no longer a tfvar. It is generated in
# main.tf (random_password) and stored in Secrets Manager, then injected into
# the ECS task via the `secrets` block — never committed, never in a task-def
# env var. See aws_secretsmanager_secret.jwt.

variable "backend_cpu" {
  type    = number
  default = 256
}

variable "backend_memory" {
  type    = number
  default = 512
}

variable "backend_desired_count" {
  type    = number
  default = 2
}

variable "backend_min_capacity" {
  type    = number
  default = 2
}

variable "backend_max_capacity" {
  type    = number
  default = 6
}

# --- Notifications (Layer 9) ---
# Single verified SES sender identity. No default: supply at apply time, e.g.
#   tofu apply -var-file=environments/staging/staging.tfvars -var "ses_sender_email=noreply@example.com"
# AWS emails a confirmation link to this address that must be clicked once —
# see modules/notifications/README.md.
variable "ses_sender_email" {
  type = string
}

# --- Monitoring / cost governance (Layer 12) ---
variable "monthly_budget_limit" {
  description = "Monthly account cost budget (USD). Alerts at 80%/100% actual and 100% forecasted."
  type        = number
  default     = 100
}

variable "billing_alert_email" {
  description = "Email address receiving budget and cost-anomaly alerts (AWS sends a one-time confirmation to it)."
  type        = string
}

# --- CI/CD (Layer 11) ---
variable "github_repository" {
  type    = string
  default = "YosefSchwartz/RentFlow" # override with the real owner/repo before applying cicd
}

variable "github_branch" {
  type    = string
  default = "main"
}
