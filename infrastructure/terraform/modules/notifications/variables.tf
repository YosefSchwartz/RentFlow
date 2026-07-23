# Notifications module — inputs.

variable "name_prefix" {
  description = "Resource-name prefix from Foundation (e.g. rentflow-staging)."
  type        = string
}

variable "tags" {
  description = "Standard tag set from Foundation (common_tags)."
  type        = map(string)
}

# With ses_domain set, this must be an address UNDER that domain (e.g.
# noreply@rent-flow.dev) — the domain identity covers it, no click needed.
# Without ses_domain, AWS emails a confirmation link to this address that a
# human must click once before SES will send from it.
variable "ses_sender_email" {
  description = "SES sender address. Under ses_domain when that is set; otherwise its own click-verified email identity."
  type        = string
}

variable "ses_domain" {
  description = "Domain to verify as a DKIM-signed SES DOMAIN identity (e.g. rent-flow.dev). Null = legacy single-email-identity mode. Requires route53_zone_id for the DKIM/SPF/DMARC records."
  type        = string
  default     = null
}

variable "route53_zone_id" {
  description = "Hosted zone ID for the ses_domain DNS records (DKIM CNAMEs, MAIL FROM MX/SPF, DMARC). Required when ses_domain is set."
  type        = string
  default     = null
}

variable "mail_from_subdomain" {
  description = "Subdomain used as the SES custom MAIL FROM (envelope sender), e.g. \"mail\" -> mail.rent-flow.dev."
  type        = string
  default     = "mail"
}

# Where bounce/complaint SNS notifications land. Defaults to ses_sender_email
# so there's always somewhere they go without a second address to configure;
# override once a real ops inbox exists.
variable "bounce_complaint_notification_email" {
  description = "Email address to receive SES bounce/complaint SNS notifications. Defaults to ses_sender_email."
  type        = string
  default     = null
}
