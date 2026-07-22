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

# AI platform (PR3). Off until Bedrock model access is granted for this account
# / region in the Bedrock console (an account setting, not IaC). Flip to true to
# enable; the task role then gets scoped bedrock:InvokeModel on the model below.
ai_enabled  = true
ai_provider = "bedrock"
ai_model_id = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
