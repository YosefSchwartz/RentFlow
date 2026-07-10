# ============================================================================
# Container registry (Layer 10) — Amazon ECR private repository.
# ============================================================================
# Holds the RentFlow backend container image. Private, scanned on push, tags
# immutable, encrypted, with a size-bounded lifecycle policy. Creates NO IAM
# users, access keys, or static credentials — same-account pulls use the ECS
# execution role (Layer 8) over the ECR VPC endpoints (Layer 9).
# ----------------------------------------------------------------------------

locals {
  repository_name = "${var.name_prefix}-${var.repository_suffix}" # e.g. rentflow-staging-backend
}

resource "aws_ecr_repository" "this" {
  name                 = local.repository_name
  image_tag_mutability = var.image_tag_mutability
  force_delete         = var.force_delete

  image_scanning_configuration {
    scan_on_push = var.scan_on_push
  }

  encryption_configuration {
    encryption_type = var.kms_key_arn == null ? "AES256" : "KMS"
    kms_key         = var.kms_key_arn
  }

  tags = merge(var.tags, { Name = local.repository_name })
}

# Cost-aware cleanup: expire untagged images quickly, keep only the last N.
resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images older than ${var.untagged_expire_days} days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = var.untagged_expire_days
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep only the most recent ${var.max_image_count} images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.max_image_count
        }
        action = { type = "expire" }
      },
    ]
  })
}
