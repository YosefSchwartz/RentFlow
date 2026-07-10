# ============================================================================
# Bootstrap — Remote State Backend
# ============================================================================
# Provisions the minimum resources the ../terraform root module needs to store
# its state remotely and safely. This is the ONLY infrastructure in this phase —
# no application resources are created here.
#
#   1. S3 bucket        — remote state storage (private, versioned, encrypted).
#   2. DynamoDB table   — state locking (LockID, PAY_PER_REQUEST).
#
# A single bucket + single lock table serve BOTH staging and production: each
# environment gets its own state key (staging/…, production/…) inside the same
# bucket, and DynamoDB locks per state key, so the backend is reused, not
# duplicated, per environment.
# ----------------------------------------------------------------------------

# --- S3 bucket for remote state ----------------------------------------------
resource "aws_s3_bucket" "state" {
  bucket        = var.state_bucket_name
  force_destroy = var.force_destroy_state_bucket

  tags = {
    Name = var.state_bucket_name
  }
}

# Keep every version of state so a corrupted/incorrect apply can be recovered.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption at rest (SSE-S3 / AES256 — no key to manage).
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block all public access.
resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Expire noncurrent state versions so the bucket does not grow unbounded,
# while still keeping enough history to recover from a bad apply.
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-noncurrent-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Reject any non-TLS access to the state bucket.
resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state_bucket.json
}

data "aws_iam_policy_document" "state_bucket" {
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

# --- DynamoDB table for state locking ----------------------------------------
# One table locks every state key in the bucket. PAY_PER_REQUEST keeps it
# essentially free for the low, spiky access pattern of state locking.
resource "aws_dynamodb_table" "lock" {
  name         = local.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name = local.lock_table_name
  }
}
