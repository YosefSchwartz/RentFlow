#!/usr/bin/env bash
#
# Deploy KeyNest's static legal/support pages to LocalStack S3 static website
# hosting — a local simulation of the production S3/CloudFront hosting so we
# never forget to ship these pages. Re-runnable (idempotent).
#
# Usage:  npm run legal:deploy      (or: bash scripts/deploy-legal-localstack.sh)
#
# Override via env: AWS_ENDPOINT, AWS_REGION, LEGAL_BUCKET, S3_PUBLIC_ENDPOINT
set -euo pipefail

ENDPOINT="${AWS_ENDPOINT:-http://localhost:4566}"
PUBLIC_ENDPOINT="${S3_PUBLIC_ENDPOINT:-$ENDPOINT}"
REGION="${AWS_REGION:-us-east-1}"
BUCKET="${LEGAL_BUCKET:-keynest-legal}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_DEFAULT_REGION="$REGION"
# AWS CLI v2 defaults to trailer/aws-chunked checksums that LocalStack rejects.
export AWS_REQUEST_CHECKSUM_CALCULATION="when_required"
export AWS_RESPONSE_CHECKSUM_VALIDATION="when_required"

LEGAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../legal" && pwd)"
aws() { command aws --endpoint-url "$ENDPOINT" "$@"; }

echo "→ Deploying legal pages to LocalStack bucket: $BUCKET ($ENDPOINT)"

# 1) Bucket (ignore "already exists")
aws s3api create-bucket --bucket "$BUCKET" >/dev/null 2>&1 || true

# 2) Public-read policy (so the website serves without credentials)
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"PublicReadLegal\",
    \"Effect\": \"Allow\",
    \"Principal\": \"*\",
    \"Action\": \"s3:GetObject\",
    \"Resource\": \"arn:aws:s3:::$BUCKET/*\"
  }]
}" >/dev/null

# 3) Static website hosting
aws s3api put-bucket-website --bucket "$BUCKET" --website-configuration '{
  "IndexDocument": { "Suffix": "index.html" },
  "ErrorDocument": { "Key": "index.html" }
}' >/dev/null

# 4) Upload. Pretty, extensionless keys so /privacy-policy etc. resolve and the
#    cross-links between pages work. All served as text/html.
put() { # <local-file> <key>
  aws s3api put-object --bucket "$BUCKET" --key "$2" \
    --body "$LEGAL_DIR/$1" --content-type "text/html; charset=utf-8" >/dev/null
  echo "   uploaded: $2"
}
put index.html          index.html
put privacy-policy.html privacy-policy
put terms-of-service.html terms-of-service
put support.html        support

echo ""
echo "✓ Legal pages deployed. Access locally:"
echo "   $PUBLIC_ENDPOINT/$BUCKET/privacy-policy"
echo "   $PUBLIC_ENDPOINT/$BUCKET/terms-of-service"
echo "   $PUBLIC_ENDPOINT/$BUCKET/support"
echo "   $PUBLIC_ENDPOINT/$BUCKET/index.html"
echo ""
echo "   S3 website endpoint (index/error routing):"
echo "   http://$BUCKET.s3-website.localhost.localstack.cloud:4566/"
