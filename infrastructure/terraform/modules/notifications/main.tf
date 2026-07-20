# ============================================================================
# Notifications (Layer 9) — Amazon SES for transactional email.
# ============================================================================
# A single verified email identity (NOT a domain identity — no DNS/Route53
# dependency). `tofu apply` creates this in "pending verification" state; AWS
# then emails a confirmation link to ses_sender_email that a human MUST click
# before SES will accept sends from it. That click is the one manual step in
# an otherwise Terraform-only feature.
#
# SES sandbox: new/unpromoted SES accounts can only send TO other verified
# addresses until AWS Support grants production access — a manual AWS Support
# request, not a Terraform gap (there is no Terraform resource for it; it's a
# written justification submitted via the SES console). Verify a couple of
# test recipient addresses in the SES console to exercise the OTP flow
# end-to-end before that's granted.
#
# The bounce/complaint SNS wiring below is what that production-access review
# actually checks ("how do you monitor and act on bounces/complaints?") — it's
# infra Terraform CAN provide, so it's provisioned up front rather than bolted
# on after a rejected request.
# ----------------------------------------------------------------------------

resource "aws_ses_email_identity" "sender" {
  email = var.ses_sender_email
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
  identity          = aws_ses_email_identity.sender.email
  notification_type = "Bounce"
  topic_arn         = aws_sns_topic.ses_bounces.arn
}

resource "aws_ses_identity_notification_topic" "complaint" {
  identity          = aws_ses_email_identity.sender.email
  notification_type = "Complaint"
  topic_arn         = aws_sns_topic.ses_complaints.arn
}
