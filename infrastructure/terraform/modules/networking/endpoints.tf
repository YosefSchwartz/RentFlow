# ============================================================================
# Private AWS connectivity (Layer 9) — VPC endpoints.
# ============================================================================
# Lets ECS tasks in the private app subnets reach AWS services WITHOUT a NAT
# Gateway or any public internet path:
#   * S3            — Gateway endpoint (free), attached to the private route tables.
#   * ECR API/DKR   — Interface endpoints (image pulls).
#   * CloudWatch Logs — Interface endpoint (awslogs driver).
#   * Secrets Manager — Interface endpoint (DB credentials).
#
# COST: each interface endpoint bills ~$0.012/ENI-hour PER AZ (~$17.5/mo at
# 2 AZs). Past ~2 endpoints a single NAT gateway (main.tf, enable_nat_gateway)
# is cheaper, so environments can turn the whole interface set off with
# var.enable_interface_endpoints = false. The S3 GATEWAY endpoint is free and
# is always kept — ECR image layers ride it instead of the NAT.
#
# Endpoint SG source: the PRIVATE APP SUBNET CIDRs (where ECS tasks run).
# Referencing the compute ECS security group here would create a
# networking <-> compute dependency cycle (compute already depends on
# networking). Scoping to the app-tier CIDRs is the cycle-free, least-privilege
# equivalent — only the app tier can reach the endpoints, never 0.0.0.0/0.
# ----------------------------------------------------------------------------

locals {
  # Interface endpoint service short-names (region prefixed at use). The base
  # set covers image pulls, logs, and secrets; callers can add more (e.g.
  # ssmmessages for ECS Exec) via var.additional_interface_endpoints — or turn
  # the whole interface set off (NAT egress instead) via
  # var.enable_interface_endpoints.
  interface_endpoint_services = var.enable_interface_endpoints ? merge(
    {
      ecr_api        = "ecr.api"
      ecr_dkr        = "ecr.dkr"
      logs           = "logs"
      secretsmanager = "secretsmanager"
    },
    var.additional_interface_endpoints,
  ) : {}
}

# --- Endpoint security group: HTTPS from the app subnets only ---
resource "aws_security_group" "endpoints" {
  count = var.enable_interface_endpoints ? 1 : 0

  name        = "${var.name_prefix}-vpce"
  description = "HTTPS from private app subnets to interface VPC endpoints"
  vpc_id      = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpce" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "endpoints_https" {
  for_each = var.enable_interface_endpoints ? local.private_app_subnets : {} # az => cidr

  security_group_id = aws_security_group.endpoints[0].id
  cidr_ipv4         = each.value
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  description       = "HTTPS from private app subnet ${each.key}"

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpce-https-${each.key}" })
}
# No egress rule: interface-endpoint ENIs only answer inbound requests
# (security groups are stateful), so egress is intentionally denied.

# --- S3 Gateway endpoint (no SG, no hourly cost) ---
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"

  # Route S3 traffic from the private tiers through the gateway endpoint.
  route_table_ids = concat(
    [for rt in aws_route_table.private_app : rt.id],
    [aws_route_table.database.id],
  )

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpce-s3" })
}

# --- Interface endpoints (ENIs in the private app subnets) ---
resource "aws_vpc_endpoint" "interface" {
  for_each = local.interface_endpoint_services

  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [for az in local.azs : aws_subnet.private_app[az].id]
  security_group_ids  = [aws_security_group.endpoints[0].id]
  private_dns_enabled = true

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpce-${each.key}" })
}
