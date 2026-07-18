# Module: notifications

Amazon SES for transactional email (OTP-based email verification and password
reset). Complements the backend's in-app `notifications` module — this is
outbound email, not the in-app notification feed.

## What this provisions

- `aws_ses_email_identity` — a single verified sender address (NOT a domain
  identity; no DNS/Route53 dependency). Scope may grow to SNS topics for push
  notifications in the future.

## The one manual step

`tofu apply` creates the identity in "pending verification" state. AWS sends
a confirmation email to `ses_sender_email` containing a link — **a human must
click it once** before SES will send from that address. This can't be done
via Terraform; it's an inherent SES requirement for any email identity.

Until that click happens, keep the backend's `EMAIL_PROVIDER` set to
`console` (logs instead of sending) so the OTP flow keeps working. Flip it to
`ses` in a follow-up deploy once verification is confirmed in the SES console.

## SES sandbox

New (or not-yet-promoted) SES accounts run in the **SES sandbox**: sends only
succeed **to** addresses that are *also* verified in SES. Moving to
production sending requires a manual AWS Support request — not a Terraform
gap, just an AWS account-level approval step. In the interim, verify 1-2 test
recipient addresses in the SES console so the OTP flow can be exercised
end-to-end against real SES before that's granted.

## Inputs

`name_prefix`, `tags`, `ses_sender_email` (no default — supplied at apply
time).

## Outputs

`ses_identity_arn`, `sender_email`.

## Future

- SNS topic(s) for fan-out (push notifications via platform applications).
- A domain identity (with DKIM) if/when sending from multiple addresses under
  one domain becomes necessary.
