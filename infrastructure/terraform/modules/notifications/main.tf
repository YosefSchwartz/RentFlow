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
# request, not a Terraform gap. Verify a couple of test recipient addresses in
# the SES console to exercise the OTP flow end-to-end before that's granted.
# ----------------------------------------------------------------------------

resource "aws_ses_email_identity" "sender" {
  email = var.ses_sender_email
}
