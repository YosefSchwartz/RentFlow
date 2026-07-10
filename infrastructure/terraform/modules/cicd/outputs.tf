# CI/CD module — outputs.

output "deploy_role_arn" {
  description = "IAM role GitHub Actions assumes via OIDC. Set as the repo variable AWS_DEPLOY_ROLE_ARN."
  value       = aws_iam_role.deploy.arn
}

output "oidc_provider_arn" {
  description = "GitHub OIDC provider ARN (created or reused)."
  value       = local.oidc_provider_arn
}
