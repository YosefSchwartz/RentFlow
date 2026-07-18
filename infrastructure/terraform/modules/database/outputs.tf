# Database module — outputs. The password is NEVER exposed (it's an input the
# caller already holds — see variables.tf — not something this module creates).

output "db_endpoint" {
  description = "Database connection host (address)."
  value       = aws_db_instance.this.address
}

output "master_username" {
  description = "Master username (not a secret — the caller needs it to build DATABASE_URL / a plain env var)."
  value       = aws_db_instance.this.username
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

output "db_instance_identifier" {
  description = "RDS instance identifier."
  value       = aws_db_instance.this.identifier
}

output "db_instance_arn" {
  description = "RDS instance ARN."
  value       = aws_db_instance.this.arn
}
