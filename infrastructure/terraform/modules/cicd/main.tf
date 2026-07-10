# ============================================================================
# CI/CD (Layer 11) — GitHub Actions → AWS via OIDC federation.
# ============================================================================
# GitHub Actions authenticates to AWS with short-lived OIDC tokens (no access
# keys, no long-lived credentials). The deploy role trusts ONLY a specific
# repository + branch, and its permissions are scoped to the backend's ECR repo
# and ECS service. Creates NO IAM users and NO access keys.
# ----------------------------------------------------------------------------

# GitHub's OIDC endpoint certificate — used to derive the provider thumbprint
# dynamically (self-maintaining; nothing hardcoded).
data "tls_certificate" "github" {
  count = var.create_oidc_provider ? 1 : 0
  url   = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [for c in data.tls_certificate.github[0].certificates : c.sha1_fingerprint]

  tags = merge(var.tags, { Name = "${var.name_prefix}-github-oidc" })
}

locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : var.existing_oidc_provider_arn
}

# Deploy role — assumable ONLY by the named repo + branch via web identity.
data "aws_iam_policy_document" "assume" {
  statement {
    sid     = "GithubOidcAssume"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    # Audience must be AWS STS.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Subject restricted to this repository + branch.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:ref:refs/heads/${var.github_branch}"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${var.name_prefix}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.assume.json

  tags = merge(var.tags, { Name = "${var.name_prefix}-github-deploy" })
}

resource "aws_iam_role_policy" "deploy" {
  name   = "${var.name_prefix}-github-deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
