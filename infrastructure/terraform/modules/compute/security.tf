# Security groups implementing: Internet → ALB → ECS (→ RDS).
#
# ALB: public HTTP (and HTTPS when a cert is set) from the internet.
# ECS: reachable ONLY from the ALB security group — never from the internet.

# --- ALB security group ---
resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb"
  description = "Public ingress to the ALB"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-alb" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  description       = "HTTP from internet"

  tags = merge(var.tags, { Name = "${var.name_prefix}-alb-http" })
}

# HTTPS opens together with the HTTPS listener (when a certificate is provided).
resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  count = var.certificate_arn == null ? 0 : 1

  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  description       = "HTTPS from internet"

  tags = merge(var.tags, { Name = "${var.name_prefix}-alb-https" })
}

# ALB may reach the tasks on the container port only.
resource "aws_vpc_security_group_egress_rule" "alb_to_ecs" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.ecs.id
  from_port                    = var.container_port
  to_port                      = var.container_port
  ip_protocol                  = "tcp"
  description                  = "ALB to ECS tasks on the container port"
}

# --- ECS task security group ---
resource "aws_security_group" "ecs" {
  name        = "${var.name_prefix}-ecs"
  description = "ECS tasks: ingress only from the ALB"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-ecs" })

  lifecycle {
    create_before_destroy = true
  }
}

# Ingress ONLY from the ALB security group — no public exposure.
resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = var.container_port
  to_port                      = var.container_port
  ip_protocol                  = "tcp"
  description                  = "Traffic from the ALB only"

  tags = merge(var.tags, { Name = "${var.name_prefix}-ecs-from-alb" })
}

# Egress: tasks need outbound to reach RDS, Secrets Manager, ECR, and CloudWatch
# (via NAT gateway or VPC endpoints — see the networking follow-up).
resource "aws_vpc_security_group_egress_rule" "ecs_all" {
  security_group_id = aws_security_group.ecs.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
  description       = "Outbound to AWS services / dependencies"
}
