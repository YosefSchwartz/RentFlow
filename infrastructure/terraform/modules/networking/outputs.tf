# Networking module — outputs consumed by future layers (database, compute,
# storage). Subnet IDs are ordered by AZ (sorted map keys).

output "vpc_id" {
  description = "VPC ID."
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "VPC CIDR block."
  value       = aws_vpc.this.cidr_block
}

output "availability_zones" {
  description = "AZs the subnets are spread across."
  value       = local.azs
}

output "public_subnet_ids" {
  description = "Public subnet IDs (ALB, NAT in a future layer)."
  value       = [for az in local.azs : aws_subnet.public[az].id]
}

output "private_app_subnet_ids" {
  description = "Private application subnet IDs (ECS/Fargate, Lambda)."
  value       = [for az in local.azs : aws_subnet.private_app[az].id]
}

output "private_db_subnet_ids" {
  description = "Private database subnet IDs (RDS subnet group)."
  value       = [for az in local.azs : aws_subnet.private_db[az].id]
}

output "public_route_table_id" {
  description = "Public route table ID."
  value       = aws_route_table.public.id
}

output "private_app_route_table_ids" {
  description = "Private application route table IDs (one per AZ)."
  value       = [for az in local.azs : aws_route_table.private_app[az].id]
}

output "database_route_table_id" {
  description = "Database route table ID."
  value       = aws_route_table.database.id
}

output "nat_gateway_id" {
  description = "NAT gateway ID (null when enable_nat_gateway = false)."
  value       = one(aws_nat_gateway.this[*].id)
}

output "nat_gateway_public_ip" {
  description = "NAT gateway public IP (null when enable_nat_gateway = false) — useful for allow-listing egress."
  value       = one(aws_eip.nat[*].public_ip)
}

# --- VPC endpoints (Layer 9 — private AWS connectivity) ---
output "vpc_endpoint_security_group_id" {
  description = "Security group protecting the interface VPC endpoints (null when enable_interface_endpoints = false)."
  value       = one(aws_security_group.endpoints[*].id)
}

output "s3_gateway_endpoint_id" {
  description = "S3 gateway VPC endpoint ID."
  value       = aws_vpc_endpoint.s3.id
}

output "interface_endpoint_ids" {
  description = "Map of interface VPC endpoint IDs (ecr_api, ecr_dkr, logs, secretsmanager)."
  value       = { for k, e in aws_vpc_endpoint.interface : k => e.id }
}
