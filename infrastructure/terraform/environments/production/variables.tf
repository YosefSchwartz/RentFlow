# Production root — inputs (values in production.tfvars).
#
# Thin interface: provider settings + values passed straight through to the
# Foundation module. Validation and defaults live in the Foundation module.

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
# Image tag (git SHA) to deploy from the private ECR repo. No default — pass at
# apply time (the tag must already be built and pushed).
variable "backend_image_tag" {
  type = string
}

# NOTE: the JWT signing secret is no longer a tfvar. It is generated in main.tf
# (random_password) and stored in Secrets Manager, then injected into the ECS
# task via the `secrets` block. See aws_secretsmanager_secret.jwt.

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

# --- CI/CD (Layer 11) ---
variable "github_repository" {
  type    = string
  default = "your-github-org/rentflow" # override with the real owner/repo before applying cicd
}

variable "github_branch" {
  type    = string
  default = "main"
}
