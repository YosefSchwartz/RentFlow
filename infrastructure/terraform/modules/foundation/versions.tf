# Foundation module — provider requirements.
#
# The module declares WHICH provider it needs (for the read-only identity data
# source used in validation). The provider is CONFIGURED in the calling root
# module (environments/<env>), never here — a reusable module must not define
# its own provider configuration.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}
