variable "project" {
  description = "Project name, used as a prefix for all resource names."
  type        = string
  default     = "rentflow"
}

variable "owner" {
  description = "Owner tag applied to all resources (team or individual responsible)."
  type        = string
}

variable "aws_region" {
  description = "AWS region for the remote state backend resources."
  type        = string
  default     = "eu-central-1"
}

variable "aws_profile" {
  description = "AWS CLI profile (IAM Identity Center / SSO session) used to authenticate. Always explicit — never relies on AWS_PROFILE."
  type        = string
  default     = "rentflow-staging"
}

variable "environment" {
  description = "Environment tag for the (shared) backend resources. They live in the active account, which currently hosts staging."
  type        = string
  default     = "staging"
}

variable "additional_tags" {
  description = "Extra tags merged on top of the standard tag set, so new tags can be added without code changes."
  type        = map(string)
  default     = {}
}

variable "state_bucket_name" {
  description = "Globally-unique name for the S3 bucket that stores remote state."
  type        = string
}

variable "force_destroy_state_bucket" {
  description = "Allow the state bucket to be destroyed even if it contains objects. Keep false for real backends."
  type        = bool
  default     = false
}
