# Staging root — surface Foundation outputs (handy for `tofu output` and for
# confirming the environment resolved as expected).

output "name_prefix" {
  description = "Resource-name prefix for staging (rentflow-staging)."
  value       = module.foundation.name_prefix
}

output "common_tags" {
  description = "Standard tag set for staging."
  value       = module.foundation.common_tags
}

output "account_id" {
  description = "AWS account the caller resolved to (validated)."
  value       = module.foundation.account_id
}

output "environment" {
  description = "Validated environment."
  value       = module.foundation.environment
}

# --- Networking (Layer 3) ---
output "vpc_id" {
  description = "VPC ID."
  value       = module.networking.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs."
  value       = module.networking.public_subnet_ids
}

output "private_app_subnet_ids" {
  description = "Private application subnet IDs."
  value       = module.networking.private_app_subnet_ids
}

output "private_db_subnet_ids" {
  description = "Private database subnet IDs."
  value       = module.networking.private_db_subnet_ids
}

output "vpc_endpoint_security_group_id" {
  description = "Interface VPC endpoint security group ID."
  value       = module.networking.vpc_endpoint_security_group_id
}

output "interface_endpoint_ids" {
  description = "Interface VPC endpoint IDs."
  value       = module.networking.interface_endpoint_ids
}

# --- Security baseline (Layer 4) ---
output "flow_log_id" {
  description = "VPC Flow Log ID."
  value       = module.security.flow_log_id
}

output "flow_log_group_name" {
  description = "CloudWatch Logs group for VPC flow logs."
  value       = module.security.cloudwatch_log_group_name
}

# --- Identity (Layer 5) ---
output "user_pool_id" {
  description = "Cognito User Pool ID."
  value       = module.identity.user_pool_id
}

output "user_pool_client_id" {
  description = "Cognito mobile app client ID."
  value       = module.identity.user_pool_client_id
}

output "cognito_issuer_url" {
  description = "OIDC issuer URL for backend JWT validation."
  value       = module.identity.issuer_url
}

output "cognito_discovery_endpoint" {
  description = "OIDC discovery document URL."
  value       = module.identity.discovery_endpoint
}

# --- Storage (Layer 6) ---
output "storage_bucket_name" {
  description = "Application data S3 bucket name."
  value       = module.storage.bucket_name
}

output "storage_bucket_arn" {
  description = "Application data S3 bucket ARN."
  value       = module.storage.bucket_arn
}

# --- Database (Layer 7) ---
output "db_endpoint" {
  description = "RDS PostgreSQL endpoint host."
  value       = module.database.db_endpoint
}

output "db_port" {
  description = "RDS PostgreSQL port."
  value       = module.database.db_port
}

output "db_name" {
  description = "Initial database name."
  value       = module.database.db_name
}

output "db_secret_arn" {
  description = "Secrets Manager ARN holding the DB master password (self-managed — no password value exposed here)."
  value       = aws_secretsmanager_secret.db_master.arn
}

output "db_security_group_id" {
  description = "Database security group ID."
  value       = module.database.security_group_id
}

# --- Compute (Layer 8) ---
output "alb_dns_name" {
  description = "Public ALB DNS name."
  value       = module.compute.alb_dns_name
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN."
  value       = module.compute.ecs_cluster_arn
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = module.compute.ecs_service_name
}

output "ecs_security_group_id" {
  description = "ECS task security group ID."
  value       = module.compute.ecs_security_group_id
}

# --- Container registry (Layer 10) ---
output "ecr_repository_url" {
  description = "Backend ECR repository URL (push here; set as compute image)."
  value       = module.container_registry.repository_url
}

output "ecr_repository_arn" {
  description = "Backend ECR repository ARN."
  value       = module.container_registry.repository_arn
}

# --- CI/CD (Layer 11) ---
output "github_deploy_role_arn" {
  description = "IAM role for GitHub Actions OIDC. Set as the repo variable AWS_DEPLOY_ROLE_ARN."
  value       = module.cicd.deploy_role_arn
}
