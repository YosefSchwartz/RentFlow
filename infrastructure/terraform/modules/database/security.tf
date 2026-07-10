# Database security group — the only ingress path to PostgreSQL.
#
# Ingress is limited to explicitly-allowed security groups / CIDRs (empty by
# default, so the database is unreachable until the backend SG is wired in).
# No 0.0.0.0/0, no public ingress. Egress is intentionally omitted (deny-all):
# RDS-managed features do not require instance-SG egress, and client return
# traffic is allowed automatically (security groups are stateful).

resource "aws_security_group" "db" {
  name        = "${var.name_prefix}-db"
  description = "PostgreSQL ingress for ${var.name_prefix} (private only)"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-db" })

  lifecycle {
    create_before_destroy = true
  }
}

# Index-based keys so for_each keys are KNOWN at plan time. The SG ids
# themselves (e.g. module.compute.ecs_security_group_id) are only known after
# apply — using them as keys (toset) would make the whole for_each unknown and
# fail planning. The list length is known at plan, so "sg-0", "sg-1", ... are
# stable keys with dynamic (apply-time) values.
locals {
  allowed_security_groups = {
    for idx, sg_id in var.allowed_security_group_ids :
    "sg-${idx}" => sg_id
  }
}

# Ingress from allowed security groups (e.g. the backend/app SG).
resource "aws_vpc_security_group_ingress_rule" "from_sg" {
  for_each = local.allowed_security_groups

  security_group_id            = aws_security_group.db.id
  referenced_security_group_id = each.value
  from_port                    = local.port
  to_port                      = local.port
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL from allowed security group"

  tags = merge(var.tags, { Name = "${var.name_prefix}-db-ingress-${each.key}" })
}

# Ingress from explicit CIDRs (e.g. a VPN range). Empty by default.
resource "aws_vpc_security_group_ingress_rule" "from_cidr" {
  for_each = toset(var.allowed_cidr_blocks)

  security_group_id = aws_security_group.db.id
  cidr_ipv4         = each.value
  from_port         = local.port
  to_port           = local.port
  ip_protocol       = "tcp"
  description       = "PostgreSQL from allowed CIDR"

  tags = merge(var.tags, { Name = "${var.name_prefix}-db-ingress-cidr" })
}
