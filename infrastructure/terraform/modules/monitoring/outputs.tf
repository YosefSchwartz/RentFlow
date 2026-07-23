# Monitoring module — outputs.

output "budget_name" {
  description = "Name of the monthly cost budget."
  value       = aws_budgets_budget.monthly.name
}

output "anomaly_monitor_arn" {
  description = "ARN of the per-service cost anomaly monitor."
  value       = aws_ce_anomaly_monitor.services.arn
}
