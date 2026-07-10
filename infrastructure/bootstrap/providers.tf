# Bootstrap layer — AWS provider (via IAM Identity Center / SSO).
#
# Authentication uses a named AWS CLI profile backed by an SSO session
# (default: rentflow-staging). No access keys, no hardcoded credentials, and no
# reliance on the AWS_PROFILE environment variable — the profile is always
# explicit. Before running, authenticate with:
#
#   aws sso login --profile rentflow-staging
#
# The bootstrap layer stores its OWN state locally (terraform.tfstate in this
# folder) on the first run, because it is the layer that provisions the remote
# backend. See backend.tf / README.md for the one-time migration to remote state.

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = local.common_tags
  }
}

locals {
  # Standard tag set applied to every resource. `additional_tags` keeps the
  # system extensible — new tags are added per invocation without code changes.
  common_tags = merge(
    {
      Project     = "RentFlow" # brand/display value; resource names use the lowercase var.project slug
      Environment = var.environment
      ManagedBy   = "OpenTofu"
      Owner       = var.owner
    },
    var.additional_tags,
  )

  # Single lock table shared by all environments' state keys.
  lock_table_name = "${var.project}-tf-lock"
}
