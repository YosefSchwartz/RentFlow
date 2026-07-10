# Compute module — outputs.

output "ecs_cluster_arn" {
  description = "ECS cluster ARN."
  value       = aws_ecs_cluster.this.arn
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.this.name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.this.name
}

output "ecs_service_arn" {
  description = "ECS service ARN (for CI/CD least-privilege scoping)."
  value       = aws_ecs_service.this.id
}

output "alb_dns_name" {
  description = "Public DNS name of the ALB (point Route53 / clients here)."
  value       = aws_lb.this.dns_name
}

output "alb_arn" {
  description = "ALB ARN."
  value       = aws_lb.this.arn
}

output "ecs_security_group_id" {
  description = "ECS task security group ID — pass to the database module's allowed_security_group_ids."
  value       = aws_security_group.ecs.id
}

output "task_role_arn" {
  description = "ECS task role ARN (attach future least-privilege app policies here)."
  value       = aws_iam_role.task.arn
}

output "execution_role_arn" {
  description = "ECS task execution role ARN."
  value       = aws_iam_role.execution.arn
}
