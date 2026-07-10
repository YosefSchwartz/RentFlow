# Storage module — inputs.
#
# Naming and tags are CONSUMED from Foundation; the module defines none of its
# own. All defaults are secure and cost-aware.

variable "name_prefix" {
  description = "Resource-name prefix from Foundation (e.g. rentflow-staging)."
  type        = string
}

variable "tags" {
  description = "Standard tag set from Foundation (common_tags)."
  type        = map(string)
}

variable "purpose" {
  description = "Bucket purpose suffix. Bucket is named <name_prefix>-<purpose> (e.g. rentflow-staging-storage)."
  type        = string
  default     = "storage"
}

variable "kms_key_arn" {
  description = "Optional customer-managed KMS key ARN. Null = SSE-S3 (AES256)."
  type        = string
  default     = null
}

variable "noncurrent_version_expiration_days" {
  description = "Delete NON-current object versions after this many days. Current (live) objects are never auto-deleted."
  type        = number
  default     = 90

  validation {
    condition     = var.noncurrent_version_expiration_days >= 1
    error_message = "noncurrent_version_expiration_days must be >= 1."
  }
}

variable "abort_multipart_days" {
  description = "Abort incomplete multipart uploads after this many days (avoids paying for orphaned parts)."
  type        = number
  default     = 7
}

variable "force_destroy" {
  description = "Allow deleting a non-empty bucket. Keep false to protect user data."
  type        = bool
  default     = false
}

# --- CORS (prepared for future browser/presigned uploads; off by default) ---
variable "cors_allowed_origins" {
  description = "Allowed CORS origins. EMPTY = no CORS rule created. Never use [\"*\"] unless explicitly justified."
  type        = list(string)
  default     = []
}

variable "cors_allowed_methods" {
  description = "Allowed CORS methods (used only when cors_allowed_origins is set)."
  type        = list(string)
  default     = ["GET", "PUT", "POST", "HEAD"]
}

variable "cors_allowed_headers" {
  description = "Allowed CORS request headers."
  type        = list(string)
  default     = ["*"]
}

variable "cors_max_age_seconds" {
  description = "How long browsers may cache CORS preflight responses."
  type        = number
  default     = 3000
}
