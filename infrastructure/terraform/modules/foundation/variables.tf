# Foundation module — inputs.
#
# This is the SINGLE place project metadata, the approved region, allowed
# environments, and the expected account are declared and validated. Downstream
# modules receive the computed outputs (name_prefix, common_tags) — they never
# re-declare or re-validate any of this.

variable "project" {
  description = "Product/project name. Used for the Project tag and (lower-cased) as the resource-name slug."
  type        = string
  default     = "RentFlow"
}

variable "application" {
  description = "Application/system name for the Application tag. Can be specialized per deployment later."
  type        = string
  default     = "rentflow"
}

variable "environment" {
  description = "Deployment environment."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be one of: staging, production."
  }
}

variable "aws_region" {
  description = "AWS region. RentFlow is single-region."
  type        = string
  default     = "eu-central-1"

  validation {
    condition     = var.aws_region == "eu-central-1"
    error_message = "aws_region must be eu-central-1 — RentFlow's only approved region."
  }
}

variable "aws_account_id" {
  description = "AWS account this environment is expected to deploy into. Validated at plan time against the caller's real account."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must be a 12-digit AWS account id."
  }
}

variable "owner" {
  description = "Owner tag applied to every resource."
  type        = string
  default     = "yosef.sh05@gmail.com"
}

variable "additional_tags" {
  description = "Extra tags merged on top of the standard set — extend tagging without touching any module."
  type        = map(string)
  default     = {}
}
