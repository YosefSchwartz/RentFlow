#!/bin/bash

# LocalStack initialization script
# This script runs automatically when LocalStack starts

set -e

echo "=============================================="
echo "Initializing KeyNest LocalStack environment..."
echo "=============================================="

# Wait for LocalStack to be ready
echo "Waiting for LocalStack services..."
awslocal s3 wait bucket-exists --bucket test-bucket 2>/dev/null || true

# Create S3 bucket for documents
echo "Creating S3 bucket: keynest-local-documents"
awslocal s3 mb s3://keynest-local-documents 2>/dev/null || echo "Bucket already exists"

# Set bucket CORS configuration for browser uploads
echo "Configuring CORS for bucket..."
awslocal s3api put-bucket-cors --bucket keynest-local-documents --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag", "x-amz-meta-custom-header"],
      "MaxAgeSeconds": 3000
    }
  ]
}'

# Verify bucket creation
echo "Verifying bucket creation..."
awslocal s3 ls

# Create a test secrets manager secret (for future use)
echo "Creating Secrets Manager secret placeholder..."
awslocal secretsmanager create-secret \
  --name keynest/local/app-secrets \
  --description "KeyNest application secrets (local development)" \
  --secret-string '{"placeholder": "Replace with actual secrets when needed"}' \
  2>/dev/null || echo "Secret already exists"

echo ""
echo "=============================================="
echo "LocalStack initialization complete!"
echo "=============================================="
echo ""
echo "S3 Endpoint: http://localhost:4566"
echo "S3 Bucket: keynest-local-documents"
echo "Secrets Manager: keynest/local/app-secrets"
echo ""
