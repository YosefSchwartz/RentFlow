# Module: notifications

Amazon SES for transactional email (OTP-based email verification and password
reset). Complements the backend's in-app `notifications` module — this is
outbound email, not the in-app notification feed.

## What this provisions

- `aws_ses_email_identity` — a single verified sender address (NOT a domain
  identity; no DNS/Route53 dependency).
- `aws_sns_topic` (x2) + `aws_ses_identity_notification_topic` (x2) — routes
  SES bounce and complaint feedback to dedicated SNS topics, each with an
  email subscription. This is the bounce/complaint handling that AWS's SES
  production-access review asks about.

## The manual steps

`tofu apply` creates the identity in "pending verification" state. AWS sends
a confirmation email to `ses_sender_email` containing a link — **a human must
click it once** before SES will send from that address. This can't be done
via Terraform; it's an inherent SES requirement for any email identity.

Until that click happens, keep the backend's `EMAIL_PROVIDER` set to
`console` (logs instead of sending) so the OTP flow keeps working. Flip it to
`ses` in a follow-up deploy once verification is confirmed in the SES console.

Each SNS email subscription (bounce, complaint) also requires **one click** on
a confirmation link sent to `bounce_complaint_notification_email` (or
`ses_sender_email` if unset) before that topic actually delivers.

## SES sandbox

New (or not-yet-promoted) SES accounts run in the **SES sandbox**: sends only
succeed **to** addresses that are *also* verified in SES. Moving to
production sending requires submitting a written request via the SES
console ("Account dashboard" → "Request production access") — there is no
Terraform resource for this; AWS reviews it manually and specifically asks
how bounces/complaints are handled, which is what the SNS topics above exist
to answer. In the interim, verify 1-2 test recipient addresses in the SES
console so the OTP flow can be exercised end-to-end against real SES before
that's granted.

## Inputs

`name_prefix`, `tags`, `ses_sender_email` (no default — supplied at apply
time), `bounce_complaint_notification_email` (optional — defaults to
`ses_sender_email`).

## Outputs

`ses_identity_arn`, `sender_email`, `ses_bounce_topic_arn`,
`ses_complaint_topic_arn`.

## Future

- A domain identity (with DKIM) if/when sending from multiple addresses under
  one domain becomes necessary — also improves deliverability over a bare
  email identity, which has no DKIM signing available.
