# IAM roles for ECS tasks. Both are assumable ONLY by the ECS tasks service,
# and only from this account (confused-deputy guard).
#
# - Execution role: pulls the image + writes logs. Uses ONLY the required AWS
#   managed policy (AmazonECSTaskExecutionRolePolicy).
# - Task role: the application's own identity. NO permissions are attached yet
#   — future least-privilege policies (S3 bucket, DB secret) are documented
#   placeholders below, scoped to specific ARNs when added.

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    sid     = "AllowEcsTasksAssume"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.aws_account_id]
    }
  }
}

# --- Execution role (infrastructure identity: pull image, write logs) ---
resource "aws_iam_role" "execution" {
  name               = "${var.name_prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = merge(var.tags, { Name = "${var.name_prefix}-ecs-execution" })
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Read the application secrets so the ECS agent can inject them via the task
# definition `secrets` block. ECS uses the EXECUTION role (not the task role)
# for secret injection. Scoped to exactly the DB credentials secret and the app
# secrets (e.g. JWT_SECRET) — GetSecretValue only, no wildcards. (Both use the
# AWS-managed Secrets Manager KMS key, so no separate kms:Decrypt grant is
# required.)
locals {
  # NOTE: no compact() here — it would make the list length unknown at plan time
  # when an ARN is a not-yet-created resource attribute (breaking `count`). The
  # inputs are never empty strings: db_secret_arn is null or a real ARN, and
  # app_secret_arns defaults to [].
  execution_secret_arns = concat(
    var.db_secret_arn == null ? [] : [var.db_secret_arn],
    var.app_secret_arns,
  )
}

data "aws_iam_policy_document" "execution_secrets" {
  count = length(local.execution_secret_arns) > 0 ? 1 : 0

  statement {
    sid       = "ReadAppSecrets"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = local.execution_secret_arns
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  count = length(local.execution_secret_arns) > 0 ? 1 : 0

  name   = "${var.name_prefix}-ecs-execution-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets[0].json
}

# --- Task role (application identity) ---
resource "aws_iam_role" "task" {
  name               = "${var.name_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = merge(var.tags, { Name = "${var.name_prefix}-ecs-task" })
}

# The app authenticates users with its OWN JWTs (symmetric HS256 signed with
# JWT_SECRET) plus DB-backed refresh sessions — it does NOT call AWS for auth.
# DB credentials arrive via the injected `secrets` block (execution role above).
# The one runtime AWS call the app makes is S3 (documents, media, attachments),
# so the task role gets least-privilege object access to the storage bucket
# ONLY — scoped to the bucket ARN, no wildcards.
data "aws_iam_policy_document" "task_s3" {
  count = var.s3_bucket_arn == null ? 0 : 1

  statement {
    sid       = "AppObjectAccess"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${var.s3_bucket_arn}/*"]
  }

  statement {
    sid       = "AppListBucket"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [var.s3_bucket_arn]
  }
}

resource "aws_iam_role_policy" "task_s3" {
  count = var.s3_bucket_arn == null ? 0 : 1

  name   = "${var.name_prefix}-ecs-task-s3"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_s3[0].json
}

# The app sends OTP emails (verification, password reset) via SES, scoped to
# exactly the one verified sender identity — no wildcards, same shape as
# task_s3 above.
data "aws_iam_policy_document" "task_ses" {
  count = var.ses_identity_arn == null ? 0 : 1

  statement {
    sid       = "AppSendEmail"
    effect    = "Allow"
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = [var.ses_identity_arn]
  }
}

resource "aws_iam_role_policy" "task_ses" {
  count = var.ses_identity_arn == null ? 0 : 1

  name   = "${var.name_prefix}-ecs-task-ses"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_ses[0].json
}

# ECS Exec: the SSM agent inside the task opens SSM Messages control/data
# channels using the TASK role's identity, so these actions belong on the task
# role (NOT the execution role). ssmmessages has no resource-level permissions,
# so the resource must be "*". Only granted when ECS Exec is enabled.
data "aws_iam_policy_document" "task_exec" {
  count = var.enable_execute_command ? 1 : 0

  statement {
    sid    = "EcsExecSSMMessages"
    effect = "Allow"
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "task_exec" {
  count = var.enable_execute_command ? 1 : 0

  name   = "${var.name_prefix}-ecs-task-exec"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_exec[0].json
}
