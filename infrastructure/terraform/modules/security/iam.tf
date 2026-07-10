# Least-privilege IAM role for VPC Flow Logs delivery to CloudWatch Logs.
#
# The role is assumable ONLY by the VPC Flow Logs service, and only from this
# account (aws:SourceAccount confused-deputy guard). Its permissions are scoped
# to the single flow-logs log group — no wildcards, no CreateLogGroup (the group
# is created here, not by the service).

data "aws_iam_policy_document" "flow_logs_assume" {
  statement {
    sid     = "AllowVpcFlowLogsAssume"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.aws_account_id]
    }
  }
}

resource "aws_iam_role" "flow_logs" {
  name               = "${var.name_prefix}-vpc-flow-logs"
  assume_role_policy = data.aws_iam_policy_document.flow_logs_assume.json

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpc-flow-logs" })
}

data "aws_iam_policy_document" "flow_logs_permissions" {
  statement {
    sid    = "WriteFlowLogsToGroup"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams",
    ]
    resources = [
      aws_cloudwatch_log_group.flow_logs.arn,
      "${aws_cloudwatch_log_group.flow_logs.arn}:*",
    ]
  }
}

resource "aws_iam_role_policy" "flow_logs" {
  name   = "${var.name_prefix}-vpc-flow-logs"
  role   = aws_iam_role.flow_logs.id
  policy = data.aws_iam_policy_document.flow_logs_permissions.json
}
