# Foundation module — outputs consumed by every downstream module.

output "name_prefix" {
  description = "Canonical resource-name prefix, e.g. rentflow-staging. Downstream modules append their own suffix."
  value       = local.name_prefix
}

output "common_tags" {
  description = "Standard tag set to apply to every resource (pass into each module)."
  value       = local.common_tags
}

output "project" {
  description = "Project name."
  value       = var.project
}

output "application" {
  description = "Application name."
  value       = var.application
}

output "environment" {
  description = "Validated environment."
  value       = var.environment
}

output "aws_region" {
  description = "Validated AWS region."
  value       = var.aws_region
}

output "account_id" {
  description = "The AWS account id the caller resolved to (validated against the expected account)."
  value       = data.aws_caller_identity.current.account_id
}
