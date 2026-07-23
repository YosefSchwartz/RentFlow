# ============================================================================
# Monitoring (Layer 12) — cost governance: AWS Budgets + Cost Anomaly Detection.
# ============================================================================
# Both services are FREE (first two budgets, all anomaly monitors) and
# account-scoped: the budget covers the whole account's spend, not just this
# environment's tags — correct while each environment lives in its own
# account. CloudWatch alarms/dashboards remain future work (see README).
# ----------------------------------------------------------------------------

# Monthly cost budget with three escalating email alerts:
#   80% actual   — early warning, time to look.
#   100% actual  — the budget is blown.
#   100% forecast — AWS predicts a blowout before it happens.
resource "aws_budgets_budget" "monthly" {
  name         = "${var.name_prefix}-monthly-cost"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_limit)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.alert_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.alert_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.alert_emails
  }

  tags = var.tags
}

# Per-SERVICE anomaly monitor: Cost Explorer learns each service's spend
# pattern and flags deviations (e.g. a new interface endpoint or an
# accidentally-upsized instance) without any threshold tuning.
resource "aws_ce_anomaly_monitor" "services" {
  name              = "${var.name_prefix}-service-anomalies"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"

  tags = var.tags
}

# Daily email digest of detected anomalies whose total cost impact reaches
# the threshold (absolute USD — a $10 surprise matters at this bill size).
resource "aws_ce_anomaly_subscription" "email" {
  name             = "${var.name_prefix}-anomaly-alerts"
  frequency        = "DAILY"
  monitor_arn_list = [aws_ce_anomaly_monitor.services.arn]

  dynamic "subscriber" {
    for_each = var.alert_emails
    content {
      type    = "EMAIL"
      address = subscriber.value
    }
  }

  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      values        = [tostring(var.anomaly_alert_threshold)]
      match_options = ["GREATER_THAN_OR_EQUAL"]
    }
  }

  tags = var.tags
}
