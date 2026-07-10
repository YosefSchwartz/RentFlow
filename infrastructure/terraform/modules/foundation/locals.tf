# Foundation module — the single source of naming + tags.

locals {
  # Lower-cased slug of the project, used for resource names.
  slug = lower(var.project)

  # Canonical name prefix: rentflow-<environment>.
  # Downstream modules build names as "${module.foundation.name_prefix}-<resource>",
  # e.g. rentflow-staging-api, rentflow-staging-documents. Never hardcoded.
  name_prefix = "${local.slug}-${var.environment}"

  # Standard tag set applied to every resource (passed into each module).
  # `additional_tags` allows extension without editing any module.
  common_tags = merge(
    {
      Project     = var.project
      Application = var.application
      Environment = var.environment
      ManagedBy   = "OpenTofu"
      Owner       = var.owner
    },
    var.additional_tags,
  )
}
