# Notifications module — inputs.

variable "name_prefix" {
  description = "Resource-name prefix from Foundation (e.g. rentflow-staging)."
  type        = string
}

variable "tags" {
  description = "Standard tag set from Foundation (common_tags)."
  type        = map(string)
}

# No default: must be supplied at apply time, e.g.
#   tofu apply -var-file=environments/staging/staging.tfvars -var "ses_sender_email=noreply@example.com"
# AWS emails a confirmation link to this address that a human must click once
# before SES will send from it — the one manual, non-Terraform step in this
# module.
variable "ses_sender_email" {
  description = "Single verified SES sender identity email address."
  type        = string
}

# Where bounce/complaint SNS notifications land. Defaults to ses_sender_email
# so there's always somewhere they go without a second address to configure;
# override once a real ops inbox exists.
variable "bounce_complaint_notification_email" {
  description = "Email address to receive SES bounce/complaint SNS notifications. Defaults to ses_sender_email."
  type        = string
  default     = null
}
