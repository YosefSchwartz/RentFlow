# Least-privilege deploy permissions: push to the backend ECR repo and roll out
# the ECS service. No CloudWatch (the rollout wait uses ecs:DescribeServices).
# No admin, no wildcard admin policies. The few "*" resources are on actions
# that AWS does not support resource-level scoping for (documented inline).

data "aws_iam_policy_document" "deploy" {
  # ECR auth token — AWS requires "*" (no resource-level support).
  statement {
    sid       = "EcrAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  # Push/pull/describe — scoped to the backend repository only.
  statement {
    sid    = "EcrPushToRepo"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
      "ecr:DescribeRepositories",
      "ecr:DescribeImages",
    ]
    resources = [var.ecr_repository_arn]
  }

  # Register a new task definition + read it — no resource-level support in AWS.
  statement {
    sid    = "EcsRegisterTaskDefinition"
    effect = "Allow"
    actions = [
      "ecs:RegisterTaskDefinition",
      "ecs:DescribeTaskDefinition",
    ]
    resources = ["*"]
  }

  # Roll out + wait — scoped to the backend service only.
  statement {
    sid    = "EcsDeployService"
    effect = "Allow"
    actions = [
      "ecs:UpdateService",
      "ecs:DescribeServices",
    ]
    resources = [var.ecs_service_arn]
  }

  # Allow passing ONLY the ECS execution + task roles to ECS (needed by
  # RegisterTaskDefinition), and only to the ECS tasks service.
  statement {
    sid       = "PassEcsRoles"
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = [var.ecs_execution_role_arn, var.ecs_task_role_arn]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}
