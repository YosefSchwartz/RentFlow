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

# JWT signing secret for the backend. Passed at apply time, never committed:
#   tofu apply ... -var "jwt_secret=$(openssl rand -base64 48)"
# NOTE: injected as a plain task-def env var, because IAM is intentionally
# scoped to the RDS secret ARN only (per requirement). Move to a dedicated
# Secrets Manager secret + scoped grant when that constraint is relaxed.
variable "jwt_secret" {
  type      = string
  sensitive = true
}

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
