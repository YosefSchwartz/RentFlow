# CI/CD module — inputs.
# Naming/tags from Foundation; ARNs from container_registry + compute so the
# deploy role is scoped to exactly those resources.

variable "name_prefix" {
  description = "Resource-name prefix from Foundation (e.g. rentflow-staging)."
  type        = string
}

variable "tags" {
  description = "Standard tag set from Foundation (common_tags)."
  type        = map(string)
}

# --- GitHub trust (repository + branch restriction) ---
variable "github_repository" {
  description = "GitHub repo allowed to assume the deploy role, as \"owner/repo\"."
  type        = string
}

variable "github_branch" {
  description = "Branch whose workflows may assume the deploy role."
  type        = string
  default     = "main"
}

# --- OIDC provider (one per AWS account) ---
variable "create_oidc_provider" {
  description = "Create the GitHub OIDC provider. Set false if the account already has one and pass existing_oidc_provider_arn."
  type        = bool
  default     = true
}

variable "existing_oidc_provider_arn" {
  description = "ARN of an existing GitHub OIDC provider (used when create_oidc_provider = false)."
  type        = string
  default     = null
}

# --- Resource ARNs the deploy role is scoped to ---
variable "ecr_repository_arn" {
  description = "ECR repository ARN (from container_registry) — push scope."
  type        = string
}

variable "ecs_service_arn" {
  description = "ECS service ARN (from compute) — update/describe scope."
  type        = string
}

variable "ecs_cluster_arn" {
  description = "ECS cluster ARN (from compute) — scopes the pre-deploy migration RunTask/DescribeTasks."
  type        = string
}

variable "ecs_execution_role_arn" {
  description = "ECS execution role ARN (from compute) — iam:PassRole scope."
  type        = string
}

variable "ecs_task_role_arn" {
  description = "ECS task role ARN (from compute) — iam:PassRole scope."
  type        = string
}
