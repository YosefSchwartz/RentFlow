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

# Read the DB credentials secret so the ECS agent can inject it via the task
# definition `secrets` block. ECS uses the EXECUTION role (not the task role)
# for secret injection. Scoped to the single RDS secret ARN — GetSecretValue
# only, no wildcards. (The RDS secret uses the AWS-managed Secrets Manager KMS
# key, so no separate kms:Decrypt grant is required.)
data "aws_iam_policy_document" "execution_secrets" {
  count = var.db_secret_arn == null ? 0 : 1

  statement {
    sid       = "ReadDbSecret"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.db_secret_arn]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  count = var.db_secret_arn == null ? 0 : 1

  name   = "${var.name_prefix}-ecs-execution-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets[0].json
}

# --- Task role (application identity: no permissions yet) ---
resource "aws_iam_role" "task" {
  name               = "${var.name_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json

  tags = merge(var.tags, { Name = "${var.name_prefix}-ecs-task" })
}

# The task role stays EMPTY: the app receives DB credentials via injected env
# (the `secrets` block, handled by the execution role above) and validates
# Cognito JWTs against a public JWKS — neither needs a runtime AWS call.
# FUTURE (add as least-privilege inline policies on aws_iam_role.task when the
# app calls AWS directly):
#   * S3: s3:GetObject/PutObject/DeleteObject on the storage bucket ARN only.
# Intentionally left ungranted here (out of scope for this change).
