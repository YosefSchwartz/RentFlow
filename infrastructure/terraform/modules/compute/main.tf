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

# Associate both Fargate capacity providers with the cluster. This costs
# nothing by itself: the service picks Spot only when var.use_fargate_spot is
# set, and one-off RunTask calls (CI migrations) keep using on-demand FARGATE.
resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
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

  # ARM64 (Graviton) is ~20% cheaper than x86 at identical Fargate sizes. The
  # image referenced by container_image MUST be built for this architecture
  # (CI builds linux/arm64 — .github/workflows/backend-deploy.yml).
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  container_definitions = jsonencode([local.container_definition])

  tags = merge(var.tags, { Name = "${var.name_prefix}-app" })
}

resource "aws_ecs_service" "this" {
  name            = "${var.name_prefix}-app"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count

  # On-demand FARGATE by default; 100% FARGATE_SPOT (~70% cheaper, 2-minute
  # interruption notice) when var.use_fargate_spot — never both. launch_type
  # and capacity_provider_strategy are mutually exclusive on a service.
  launch_type = var.use_fargate_spot ? null : "FARGATE"

  dynamic "capacity_provider_strategy" {
    for_each = var.use_fargate_spot ? [1] : []
    content {
      capacity_provider = "FARGATE_SPOT"
      weight            = 1
    }
  }

  # Required to move between launch_type and a capacity provider strategy
  # in place (ECS otherwise rejects the update / Terraform replaces the
  # service). Only takes effect on applies that actually change the service.
  force_new_deployment = true

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

  # The capacity provider must be associated with the cluster before a service
  # can reference it in its strategy.
  depends_on = [aws_lb_listener.http, aws_ecs_cluster_capacity_providers.this]
}
