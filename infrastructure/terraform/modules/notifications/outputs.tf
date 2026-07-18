# Notifications module — outputs.

output "ses_identity_arn" {
  description = "SES email identity ARN (grant the ECS task role ses:SendEmail scoped to this)."
  value       = aws_ses_email_identity.sender.arn
}

output "sender_email" {
  description = "The verified sender address (echoes the input for convenience)."
  value       = var.ses_sender_email
}
