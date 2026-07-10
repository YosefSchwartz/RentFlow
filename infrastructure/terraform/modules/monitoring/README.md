# Module: monitoring

**Status:** placeholder — not implemented yet.

Observability and cost governance (Well-Architected: Operational Excellence +
Cost Optimization).

## Planned resources
- CloudWatch log groups, metric alarms, dashboards
- Alarm actions wired to the `notifications` SNS topics
- AWS Budgets (monthly spend + alerts)
- Cost Anomaly Detection monitor + subscription

## Expected inputs
`name_prefix`, `tags`, `alarm_topic_arn`, `monthly_budget_amount`,
`log_retention_days`

## Expected outputs
`dashboard_name`, alarm ARNs, budget name
