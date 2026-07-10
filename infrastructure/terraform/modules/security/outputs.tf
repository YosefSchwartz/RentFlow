# Security module — outputs.

output "flow_log_id" {
  description = "VPC Flow Log ID."
  value       = aws_flow_log.vpc.id
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch Logs group receiving VPC flow logs."
  value       = aws_cloudwatch_log_group.flow_logs.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the flow-logs CloudWatch Logs group."
  value       = aws_cloudwatch_log_group.flow_logs.arn
}

output "iam_role_arn" {
  description = "ARN of the least-privilege IAM role used for flow-log delivery."
  value       = aws_iam_role.flow_logs.arn
}

output "iam_role_name" {
  description = "Name of the flow-logs IAM role."
  value       = aws_iam_role.flow_logs.name
}
