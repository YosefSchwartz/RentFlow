# Module: monitoring

**Status:** cost governance implemented (AWS Budgets + Cost Anomaly Detection).
CloudWatch alarms/dashboards remain future work.

Cost governance (Well-Architected: Cost Optimization). Both resources are
free and account-scoped — the budget watches the ACCOUNT's total spend, which
is correct while each environment lives in its own account.

## Resources
- `aws_budgets_budget` — monthly USD budget with email alerts at 80% actual,
  100% actual, and 100% forecasted spend.
- `aws_ce_anomaly_monitor` — per-SERVICE anomaly monitor (Cost Explorer
  learns each service's pattern; no thresholds to tune).
- `aws_ce_anomaly_subscription` — daily email digest of anomalies whose total
  impact is ≥ `anomaly_alert_threshold` USD.

## Inputs
`name_prefix`, `tags`, `monthly_budget_limit`, `alert_emails`,
`anomaly_alert_threshold` (default 10).

Note: each alert email address receives a one-time confirmation email from
AWS that must be accepted before notifications are delivered.

## Outputs
`budget_name`, `anomaly_monitor_arn`.

## Planned (not yet implemented)
- CloudWatch metric alarms + dashboards
- Alarm actions wired to the `notifications` SNS topics
