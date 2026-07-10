# Identity module — outputs.
# Consumed later by mobile configuration and backend JWT-validation middleware.

output "user_pool_id" {
  description = "Cognito User Pool ID."
  value       = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN."
  value       = aws_cognito_user_pool.this.arn
}

output "user_pool_client_id" {
  description = "Mobile app client ID (public, no secret)."
  value       = aws_cognito_user_pool_client.mobile.id
}

output "user_pool_endpoint" {
  description = "User pool endpoint (cognito-idp.<region>.amazonaws.com/<pool-id>)."
  value       = aws_cognito_user_pool.this.endpoint
}

output "issuer_url" {
  description = "OIDC issuer URL — backend token validation uses this."
  value       = "https://${aws_cognito_user_pool.this.endpoint}"
}

output "discovery_endpoint" {
  description = "OIDC discovery document (JWKS + endpoints) for backend JWT validation."
  value       = "https://${aws_cognito_user_pool.this.endpoint}/.well-known/openid-configuration"
}
