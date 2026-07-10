# Database module — outputs. The password is NEVER exposed.

output "db_endpoint" {
  description = "Database connection host (address)."
  value       = aws_db_instance.this.address
}

output "db_port" {
  description = "Database port."
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Initial database name."
  value       = aws_db_instance.this.db_name
}

output "security_group_id" {
  description = "Database security group ID (reference it from the backend SG's egress / as an ingress source)."
  value       = aws_security_group.db.id
}

output "secret_arn" {
  description = "ARN of the RDS-managed Secrets Manager secret holding the master credentials (username + password)."
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
}

output "db_instance_identifier" {
  description = "RDS instance identifier."
  value       = aws_db_instance.this.identifier
}

output "db_instance_arn" {
  description = "RDS instance ARN."
  value       = aws_db_instance.this.arn
}
