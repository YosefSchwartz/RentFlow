# Production remote-state backend configuration.
# Supplied at init time (run from this folder):  tofu init -backend-config=backend.hcl
#
# PREPARED — the backend is wired, but no production resources are provisioned
# yet. State lives in the SAME shared bucket as staging, isolated by `key`.
#
# NOTE ON PROFILES: `profile` here is for STATE access, and the state bucket
# lives in the active (staging) account — so it is `rentflow-staging`. Production
# *resource* provisioning uses a separate provider profile (`rentflow-production`
# in production.tfvars); the two are intentionally different.

bucket         = "rentflow-tfstate-304126178791"
key            = "production/terraform.tfstate"
region         = "eu-central-1"
encrypt        = true
dynamodb_table = "rentflow-tf-lock"

profile = "rentflow-staging"
