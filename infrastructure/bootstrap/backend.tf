# Bootstrap remote backend — DISABLED until the first apply completes.
#
# Why disabled: this layer CREATES the S3 bucket + DynamoDB lock table. On the
# very first run those do not exist yet, so bootstrap must run on LOCAL state.
# Enabling the backend before the resources exist would be a circular dependency.
#
# One-time migration to remote state (AFTER `tofu apply` has created them):
#   1. Fill `bucket` below with the value from `tofu output state_bucket_name`.
#   2. Uncomment the block.
#   3. Run:  tofu init -migrate-state
#      (OpenTofu copies the local state into the bucket and starts locking via
#       the DynamoDB table.)
#
# Backend blocks cannot use variables, so the values are literal on purpose.
#
# terraform {
#   backend "s3" {
#     bucket         = "rentflow-tfstate-<account-id>"
#     key            = "bootstrap/terraform.tfstate"
#     region         = "eu-central-1"
#     dynamodb_table = "rentflow-tf-lock"
#     encrypt        = true
#     profile        = "rentflow-staging"
#   }
# }
