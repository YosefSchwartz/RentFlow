# Staging environment values.
# Supplied at plan/apply time:  tofu plan -var-file=environments/staging/staging.tfvars
#
# Only environment-varying inputs belong here.

environment    = "staging"
aws_region     = "eu-central-1"
aws_profile    = "rentflow-staging"
aws_account_id = "304126178791"
vpc_cidr       = "10.0.0.0/16"

additional_tags = {
  CostCenter = "rentflow-staging"
}
