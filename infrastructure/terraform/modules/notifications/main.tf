# ============================================================================
# Notifications (Layer 9) — Amazon SES for transactional email.
# ============================================================================
# Two identity modes:
#
#   * ses_domain set (current) — a DOMAIN identity with Easy DKIM. Verification
#     is pure DNS (the DKIM CNAMEs below, in Route53) — no human click. Any
#     address under the domain (noreply@...) may send; DKIM + custom MAIL FROM
#     give SPF/DKIM/DMARC alignment, which SES production-access review
#     effectively requires.
#   * ses_domain null (legacy) — a single verified EMAIL identity. AWS emails
#     a confirmation link to ses_sender_email that a human must click.
#
# SES sandbox: new/unpromoted SES accounts can only send TO verified addresses
# until AWS grants production access (requested via PutAccountDetails / the
# console — no Terraform resource exists for it). The bounce/complaint SNS
# wiring below is what that review actually checks ("how do you monitor and
# act on bounces/complaints?") — it's infra Terraform CAN provide, so it's
# provisioned up front.
# ----------------------------------------------------------------------------

locals {
  use_domain = var.ses_domain != null
}

# Region is used to build the SES MAIL FROM MX target (never hardcoded).
data "aws_region" "current" {}

# --- Legacy mode: single verified email address ---
resource "aws_ses_email_identity" "sender" {
  count = local.use_domain ? 0 : 1

  email = var.ses_sender_email
}

# --- Domain mode: DKIM-signed domain identity ---
resource "aws_sesv2_email_identity" "domain" {
  count = local.use_domain ? 1 : 0

  email_identity = var.ses_domain

  tags = merge(var.tags, { Name = "${var.name_prefix}-ses-domain" })
}

# Custom MAIL FROM subdomain so the envelope sender (Return-Path) is under our
# domain — SPF alignment for DMARC. Falls back to amazonses.com on MX failure
# rather than refusing to send.
resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  count = local.use_domain ? 1 : 0

  email_identity         = aws_sesv2_email_identity.domain[0].email_identity
  mail_from_domain       = "${var.mail_from_subdomain}.${var.ses_domain}"
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

# --- DNS records (Route53) proving domain ownership + authenticating mail ---
# Easy DKIM: three CNAMEs; SES flips the identity to VERIFIED once it sees
# them. TTLs are short while the setup is young.
resource "aws_route53_record" "dkim" {
  count = local.use_domain ? 3 : 0

  zone_id = var.route53_zone_id
  name    = "${aws_sesv2_email_identity.domain[0].dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.ses_domain}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${aws_sesv2_email_identity.domain[0].dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_route53_record" "mail_from_mx" {
  count = local.use_domain ? 1 : 0

  zone_id = var.route53_zone_id
  name    = "${var.mail_from_subdomain}.${var.ses_domain}"
  type    = "MX"
  ttl     = 1800
  records = ["10 feedback-smtp.${data.aws_region.current.name}.amazonses.com"]
}

resource "aws_route53_record" "mail_from_spf" {
  count = local.use_domain ? 1 : 0

  zone_id = var.route53_zone_id
  name    = "${var.mail_from_subdomain}.${var.ses_domain}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=spf1 include:amazonses.com ~all"]
}

# DMARC in monitor-only mode (p=none): mailbox providers report alignment
# without rejecting anything. Tighten to quarantine/reject once sending is
# established.
resource "aws_route53_record" "dmarc" {
  count = local.use_domain ? 1 : 0

  zone_id = var.route53_zone_id
  name    = "_dmarc.${var.ses_domain}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=DMARC1; p=none;"]
}

# One topic per feedback type so the review can point at distinct, purpose-
# named ARNs. A human must confirm the email subscription once (SNS sends a
# confirmation link) — same shape as the identity-verification click above.
resource "aws_sns_topic" "ses_bounces" {
  name = "${var.name_prefix}-ses-bounces"
  tags = var.tags
}

resource "aws_sns_topic" "ses_complaints" {
  name = "${var.name_prefix}-ses-complaints"
  tags = var.tags
}

resource "aws_sns_topic_subscription" "ses_bounces_email" {
  topic_arn = aws_sns_topic.ses_bounces.arn
  protocol  = "email"
  endpoint  = coalesce(var.bounce_complaint_notification_email, var.ses_sender_email)
}

resource "aws_sns_topic_subscription" "ses_complaints_email" {
  topic_arn = aws_sns_topic.ses_complaints.arn
  protocol  = "email"
  endpoint  = coalesce(var.bounce_complaint_notification_email, var.ses_sender_email)
}

resource "aws_ses_identity_notification_topic" "bounce" {
  identity          = local.use_domain ? aws_sesv2_email_identity.domain[0].email_identity : aws_ses_email_identity.sender[0].email
  notification_type = "Bounce"
  topic_arn         = aws_sns_topic.ses_bounces.arn
}

resource "aws_ses_identity_notification_topic" "complaint" {
  identity          = local.use_domain ? aws_sesv2_email_identity.domain[0].email_identity : aws_ses_email_identity.sender[0].email
  notification_type = "Complaint"
  topic_arn         = aws_sns_topic.ses_complaints.arn
}
