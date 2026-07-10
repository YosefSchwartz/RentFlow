# ============================================================================
# Security baseline (Layer 4) — VPC Flow Logs → CloudWatch Logs.
# ============================================================================
# Establishes network-traffic auditing as a secure default before any
# application services exist. Account-level expectations (S3 public-access
# block, secure transport, encryption, IAM guidelines) are documented in
# ../../../ARCHITECTURE.md rather than provisioned here — they are account-wide
# singletons that belong in a dedicated account layer, not a per-env module.
# ----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "flow_logs" {
  name              = "/${var.name_prefix}/vpc/flow-logs"
  retention_in_days = var.flow_log_retention_days
  kms_key_id        = var.log_kms_key_arn # null → default CloudWatch Logs encryption at rest

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpc-flow-logs" })
}

resource "aws_flow_log" "vpc" {
  vpc_id                   = var.vpc_id
  traffic_type             = var.flow_log_traffic_type
  log_destination_type     = "cloud-watch-logs"
  log_destination          = aws_cloudwatch_log_group.flow_logs.arn
  iam_role_arn             = aws_iam_role.flow_logs.arn
  max_aggregation_interval = 600

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpc-flow-log" })
}
