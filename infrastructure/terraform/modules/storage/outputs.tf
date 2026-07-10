# Storage module — outputs.

output "bucket_id" {
  description = "S3 bucket ID (name)."
  value       = aws_s3_bucket.this.id
}

output "bucket_arn" {
  description = "S3 bucket ARN (grant future app roles least-privilege access to this ARN)."
  value       = aws_s3_bucket.this.arn
}

output "bucket_name" {
  description = "S3 bucket name."
  value       = aws_s3_bucket.this.bucket
}

output "bucket_regional_domain_name" {
  description = "Regional domain name (for building object URLs / presigned uploads)."
  value       = aws_s3_bucket.this.bucket_regional_domain_name
}
