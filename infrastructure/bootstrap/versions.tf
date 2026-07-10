# Bootstrap layer — version constraints.
#
# The bootstrap layer intentionally runs on a LOCAL backend at first (see
# backend.tf). It is the chicken-and-egg layer that CREATES the remote state
# backend (S3 bucket + DynamoDB lock table) used by everything under
# ../terraform, so it cannot itself depend on that backend until it exists.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}
