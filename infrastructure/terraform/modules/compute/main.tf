# ============================================================================
# Compute (Layer 8) — ECS Fargate cluster, task definition, and service.
# ============================================================================
# Runs the RentFlow backend container in the PRIVATE application subnets (no
# public IP), behind the public ALB. Tasks reach RDS/Secrets Manager/ECR via
# egress (NAT gateway or VPC endpoints — a networking follow-up).
# ----------------------------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = var.container_insights
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-cluster" })
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/${var.name_prefix}/ecs/${var.container_name}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, { Name = "${var.name_prefix}-ecs-logs" })
}

locals {
  # Container definition. `secrets` are resolved by the ECS agent (execution
  # role) at launch — their values never appear in the task definition or state.
  # `command` is only included when overridden.
  container_definition = merge(
    {
      name      = var.container_name
      image     = var.container_image
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [for k, v in var.container_environment : { name = k, value = v }]
      secrets     = [for k, v in var.container_secrets : { name = k, valueFrom = v }]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = var.container_name
        }
      }
    },
    var.container_command == null ? {} : { command = var.container_command },
  )
}

resource "aws_ecs_task_definition" "this" {
  family                   = "${var.name_prefix}-app"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([local.container_definition])

  tags = merge(var.tags, { Name = "${var.name_prefix}-app" })
}

resource "aws_ecs_service" "this" {
  name            = "${var.name_prefix}-app"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  # ECS Exec (`aws ecs execute-command`) — off by default; the task role gets
  # the ssmmessages permissions only when this is enabled (see iam.tf).
  enable_execute_command = var.enable_execute_command

  health_check_grace_period_seconds  = var.health_check_grace_period_seconds
  deployment_minimum_healthy_percent = var.deployment_minimum_healthy_percent
  deployment_maximum_percent         = var.deployment_maximum_percent

  # Tasks run privately — no public IP, ever.
  network_configuration {
    subnets          = var.private_app_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.this.arn
    container_name   = var.container_name
    container_port   = var.container_port
  }

  # Auto-rollback a failed deployment.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # Autoscaling owns desired_count after the initial deploy.
  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-app" })

  depends_on = [aws_lb_listener.http]
}
