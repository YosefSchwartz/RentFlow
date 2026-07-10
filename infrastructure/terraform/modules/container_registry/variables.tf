# Container registry module — inputs.
# Naming/tags from Foundation; secure defaults, all overridable.

variable "name_prefix" {
  description = "Resource-name prefix from Foundation (e.g. rentflow-staging)."
  type        = string
}

variable "tags" {
  description = "Standard tag set from Foundation (common_tags)."
  type        = map(string)
}

variable "repository_suffix" {
  description = "Repository purpose suffix. Repo is named <name_prefix>-<suffix> (e.g. rentflow-staging-backend)."
  type        = string
  default     = "backend"
}

variable "image_tag_mutability" {
  description = "Tag mutability. IMMUTABLE prevents overwriting an existing tag (reproducible deploys)."
  type        = string
  default     = "IMMUTABLE"

  validation {
    condition     = contains(["IMMUTABLE", "MUTABLE"], var.image_tag_mutability)
    error_message = "image_tag_mutability must be IMMUTABLE or MUTABLE."
  }
}

variable "scan_on_push" {
  description = "Scan images for vulnerabilities on push."
  type        = bool
  default     = true
}

variable "kms_key_arn" {
  description = "Optional customer-managed KMS key ARN. Null = ECR default encryption (AES256)."
  type        = string
  default     = null
}

variable "max_image_count" {
  description = "Keep only the most recent N images; older ones are expired."
  type        = number
  default     = 10

  validation {
    condition     = var.max_image_count >= 1
    error_message = "max_image_count must be >= 1."
  }
}

variable "untagged_expire_days" {
  description = "Expire untagged images older than this many days."
  type        = number
  default     = 14
}

variable "force_delete" {
  description = "Allow deleting the repository even if it still contains images. Keep false to protect images."
  type        = bool
  default     = false
}
