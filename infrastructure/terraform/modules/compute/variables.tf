# Compute module — inputs.
#
# Naming/tags from Foundation; network refs from Networking. The application
# image is always supplied by the caller — never hardcoded.

variable "name_prefix" {
  description = "Resource-name prefix from Foundation (e.g. rentflow-staging)."
  type        = string
}

variable "tags" {
  description = "Standard tag set from Foundation (common_tags)."
  type        = map(string)
}

variable "aws_account_id" {
  description = "Expected AWS account id (from Foundation) — confused-deputy guard on the ECS roles."
  type        = string
}

# --- Networking ---
variable "vpc_id" {
  description = "VPC ID (from Networking)."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the ALB (from Networking)."
  type        = list(string)
}

variable "private_app_subnet_ids" {
  description = "Private application subnet IDs for ECS tasks (from Networking)."
  type        = list(string)
}

# --- Container / task ---
variable "container_image" {
  description = "Container image to run. Replace the placeholder with the RentFlow backend image (ECR)."
  type        = string
  default     = "public.ecr.aws/nginx/nginx:stable" # placeholder — NOT the RentFlow backend
}

variable "container_name" {
  description = "Container name inside the task definition."
  type        = string
  default     = "app"
}

variable "container_port" {
  description = "Port the container listens on (RentFlow backend uses 3000)."
  type        = number
  default     = 3000
}

variable "cpu" {
  description = "Task CPU units (256 = 0.25 vCPU)."
  type        = number
  default     = 256
}

variable "memory" {
  description = "Task memory (MiB). Must be a valid Fargate pairing with cpu."
  type        = number
  default     = 512
}

variable "container_environment" {
  description = "Non-secret environment variables for the container (name => value)."
  type        = map(string)
  default     = {}
}

variable "container_secrets" {
  description = "Secret env vars (name => Secrets Manager valueFrom, e.g. \"<arn>:json-key::\"). Injected by the ECS agent at launch via the EXECUTION role."
  type        = map(string)
  default     = {}
}

variable "container_command" {
  description = "Optional container command, overriding the image CMD. Null = use the image default."
  type        = list(string)
  default     = null
}

variable "db_secret_arn" {
  description = "RDS Secrets Manager secret ARN the EXECUTION role may read (for the `secrets` block). Null = grant nothing. Scoped to this one ARN, no wildcards."
  type        = string
  default     = null
}

variable "app_secret_arns" {
  description = "Additional Secrets Manager secret ARNs the EXECUTION role may read for the `secrets` block (e.g. the JWT signing secret). Scoped to exactly these ARNs, no wildcards."
  type        = list(string)
  default     = []
}

variable "s3_bucket_arn" {
  description = "S3 bucket ARN the TASK role may read/write for application files (documents, media, attachments). Null = grant nothing."
  type        = string
  default     = null
}

variable "ses_identity_arn" {
  description = "SES verified identity ARN the TASK role may send from (OTP emails). Null = grant nothing."
  type        = string
  default     = null
}

variable "enable_execute_command" {
  description = "Enable ECS Exec (`aws ecs execute-command`) on the service and grant the TASK role the required SSM Messages permissions. Requires ssmmessages VPC connectivity (an interface endpoint when there is no NAT)."
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention for container logs."
  type        = number
  default     = 30
}

# --- Service / deployment ---
variable "desired_count" {
  description = "Initial number of running tasks (autoscaling manages it afterwards)."
  type        = number
  default     = 2
}

variable "deployment_minimum_healthy_percent" {
  description = "Minimum healthy percent during deployments."
  type        = number
  default     = 100
}

variable "deployment_maximum_percent" {
  description = "Maximum percent during deployments."
  type        = number
  default     = 200
}

variable "health_check_path" {
  description = "ALB target-group health check path. Set to the backend's health route (e.g. /api/health)."
  type        = string
  default     = "/"
}

variable "health_check_grace_period_seconds" {
  description = "Grace period before health checks count against a new task."
  type        = number
  default     = 60
}

# --- Autoscaling ---
variable "min_capacity" {
  description = "Minimum task count for autoscaling."
  type        = number
  default     = 2
}

variable "max_capacity" {
  description = "Maximum task count for autoscaling."
  type        = number
  default     = 6
}

variable "cpu_target_value" {
  description = "Target average CPU utilization (%) for target-tracking autoscaling."
  type        = number
  default     = 60
}

# --- Cluster / TLS ---
variable "container_insights" {
  description = "ECS Container Insights setting (enabled / enhanced / disabled)."
  type        = string
  default     = "enabled"

  validation {
    condition     = contains(["enabled", "enhanced", "disabled"], var.container_insights)
    error_message = "container_insights must be one of: enabled, enhanced, disabled."
  }
}

variable "certificate_arn" {
  description = "ACM certificate ARN. When set, an HTTPS:443 listener is added and HTTP:80 redirects to it. Null = HTTP only (until ACM/DNS exist)."
  type        = string
  default     = null
}
