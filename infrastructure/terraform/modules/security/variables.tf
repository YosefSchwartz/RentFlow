# Security module — inputs.
#
# Naming and tags are CONSUMED from Foundation; the VPC id from Networking.
# This module defines no project/tag/region values of its own.

variable "name_prefix" {
  description = "Resource-name prefix from Foundation (e.g. rentflow-staging)."
  type        = string
}

variable "tags" {
  description = "Standard tag set from Foundation (common_tags)."
  type        = map(string)
}

variable "vpc_id" {
  description = "VPC to enable flow logs on (from the Networking module)."
  type        = string
}

variable "aws_account_id" {
  description = "Expected AWS account id (from Foundation) — used as a confused-deputy guard on the flow-logs role."
  type        = string
}

variable "flow_log_retention_days" {
  description = "CloudWatch Logs retention (days) for VPC flow logs."
  type        = number
  default     = 30

  validation {
    condition = contains(
      [1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653],
      var.flow_log_retention_days
    )
    error_message = "flow_log_retention_days must be a valid CloudWatch Logs retention value (e.g. 7, 30, 90, 365)."
  }
}

variable "flow_log_traffic_type" {
  description = "Which traffic to capture: ACCEPT, REJECT, or ALL."
  type        = string
  default     = "ALL"

  validation {
    condition     = contains(["ACCEPT", "REJECT", "ALL"], var.flow_log_traffic_type)
    error_message = "flow_log_traffic_type must be one of: ACCEPT, REJECT, ALL."
  }
}

variable "log_kms_key_arn" {
  description = "Optional customer-managed KMS key ARN to encrypt the flow-logs group. Null = default CloudWatch Logs encryption."
  type        = string
  default     = null
}
