output "state_bucket_name" {
  description = "Name of the S3 bucket holding remote state. Use in each environment's backend.hcl."
  value       = aws_s3_bucket.state.id
}

output "state_bucket_arn" {
  description = "ARN of the remote state bucket."
  value       = aws_s3_bucket.state.arn
}

output "dynamodb_lock_table_name" {
  description = "Name of the DynamoDB state-lock table. Use in each environment's backend.hcl (dynamodb_table)."
  value       = aws_dynamodb_table.lock.name
}

output "dynamodb_lock_table_arn" {
  description = "ARN of the DynamoDB state-lock table."
  value       = aws_dynamodb_table.lock.arn
}

output "region" {
  description = "Region the backend resources live in."
  value       = var.aws_region
}
