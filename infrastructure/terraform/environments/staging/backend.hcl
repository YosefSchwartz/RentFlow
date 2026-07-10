# Staging remote-state backend configuration.
# Supplied at init time (run from this folder):  tofu init -backend-config=backend.hcl
#
# Values come from the bootstrap layer outputs
# (`state_bucket_name`, `dynamodb_lock_table_name`).

bucket         = "rentflow-tfstate-304126178791"
key            = "staging/terraform.tfstate"
region         = "eu-central-1"
encrypt        = true
dynamodb_table = "rentflow-tf-lock"

# Profile that can read/write the shared state bucket (the active RentFlow account).
profile = "rentflow-staging"
