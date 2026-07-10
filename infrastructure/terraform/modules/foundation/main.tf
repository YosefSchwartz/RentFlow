# Foundation module — validation only. Creates NO AWS resources.
#
# The only AWS interaction is a READ of the caller identity, used to guarantee
# that planning/applying is happening against the AWS account this environment
# expects. The data-source `postcondition` produces a HARD ERROR at plan time
# (not a warning), so `tofu plan` fails when credentials point at the wrong
# account — e.g. staging config accidentally run with production credentials.
#
# Region and environment are validated as inputs (see variables.tf), which fail
# even earlier during variable evaluation.

data "aws_caller_identity" "current" {
  lifecycle {
    postcondition {
      condition     = self.account_id == var.aws_account_id
      error_message = "AWS account mismatch: credentials resolve to account ${self.account_id}, but environment '${var.environment}' expects ${var.aws_account_id}. Re-check your AWS SSO profile (aws sso login --profile rentflow-<env>)."
    }
  }
}
