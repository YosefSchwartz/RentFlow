# Monitoring module — inputs.
#
# Naming and tags are CONSUMED from the Foundation module (passed in by the
# root). This module never defines project/tag values of its own.

variable "name_prefix" {
  description = "Resource-name prefix from Foundation (e.g. rentflow-staging)."
  type        = string
}

variable "tags" {
  description = "Standard tag set from Foundation (common_tags). Applied to every resource."
  type        = map(string)
}

variable "monthly_budget_limit" {
  description = "Monthly cost budget for the ACCOUNT in USD. Email alerts fire at 80% actual, 100% actual, and 100% forecasted."
  type        = number

  validation {
    condition     = var.monthly_budget_limit > 0
    error_message = "monthly_budget_limit must be a positive USD amount."
  }
}

variable "alert_emails" {
  description = "Email addresses that receive budget and cost-anomaly alerts. Each address gets a one-time confirmation email from AWS that must be accepted."
  type        = list(string)

  validation {
    condition     = length(var.alert_emails) > 0
    error_message = "alert_emails must contain at least one address — alerts nobody receives are not alerts."
  }
}

variable "anomaly_alert_threshold" {
  description = "Minimum total cost impact (absolute USD) of a detected anomaly before it is emailed."
  type        = number
  default     = 10
}
