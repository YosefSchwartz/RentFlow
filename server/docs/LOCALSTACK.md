# LocalStack Setup Guide

This guide explains how to use LocalStack for local AWS development in RentFlow.

## Overview

LocalStack provides a local emulation of AWS services, allowing you to develop and test AWS integrations without incurring costs or requiring an AWS account during development.

### Enabled Services

- **S3**: Object storage for document uploads
- **Secrets Manager**: Secret storage (prepared for future use)

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ installed

### Starting Services

```bash
# Start PostgreSQL + LocalStack + API (recommended for development)
npm run dev:services

# Or start services separately:
npm run db:start           # Start PostgreSQL only
npm run localstack:start   # Start LocalStack only
npm run services:start     # Start both PostgreSQL and LocalStack
```

### Stopping Services

```bash
npm run services:stop      # Stop both PostgreSQL and LocalStack
npm run localstack:stop    # Stop LocalStack only
npm run db:stop            # Stop PostgreSQL only
```

### Viewing Logs

```bash
npm run localstack:logs
```

## Configuration

### Environment Variables

Copy `.env.localstack.example` to `.env` or add these variables:

```env
# AWS / LocalStack Configuration
AWS_REGION=eu-central-1
AWS_ENDPOINT=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
S3_BUCKET_NAME=keynest-local-documents
```

### Switching to Real AWS

To use real AWS instead of LocalStack:

1. Remove or comment out `AWS_ENDPOINT`
2. Set real AWS credentials:
   ```env
   AWS_ACCESS_KEY_ID=your-aws-access-key
   AWS_SECRET_ACCESS_KEY=your-aws-secret-key
   ```
3. Ensure the S3 bucket exists in your AWS account

## S3 Storage

### Automatic Bucket Creation

The LocalStack initialization script (`scripts/localstack-init.sh`) automatically creates:

- S3 bucket: `keynest-local-documents`
- CORS configuration for browser uploads
- Secrets Manager placeholder secret

### Manual Bucket Operations

If you need to interact with S3 manually:

```bash
# List buckets
aws --endpoint-url=http://localhost:4566 s3 ls

# List files in bucket
aws --endpoint-url=http://localhost:4566 s3 ls s3://keynest-local-documents

# Upload a test file
aws --endpoint-url=http://localhost:4566 s3 cp test.txt s3://keynest-local-documents/test.txt

# Download a file
aws --endpoint-url=http://localhost:4566 s3 cp s3://keynest-local-documents/test.txt ./downloaded.txt
```

### Using awslocal

LocalStack provides `awslocal` command which is `aws` pre-configured for LocalStack:

```bash
# Inside the LocalStack container
docker exec -it keynest-localstack awslocal s3 ls
```

## Document Upload Flow

### Client-Side Upload (Recommended for large files)

1. Client requests a signed upload URL:
   ```
   POST /api/properties/:propertyId/documents/upload-url
   {
     "name": "Insurance Document",
     "filename": "insurance.pdf",
     "category": "INSURANCE",
     "mimeType": "application/pdf",
     "fileSize": 1024000
   }
   ```

2. Server responds with:
   ```json
   {
     "uploadUrl": "http://localhost:4566/keynest-local-documents/...",
     "key": "property/abc123/uuid-insurance.pdf",
     "publicUrl": "http://localhost:4566/keynest-local-documents/...",
     "document": {
       "id": "doc123",
       "name": "Insurance Document",
       "category": "INSURANCE",
       "fileUrl": "http://localhost:4566/..."
     }
   }
   ```

3. Client uploads directly to S3 using the `uploadUrl`

4. Document is immediately available at `publicUrl`

### Server-Side Upload (For smaller files)

```
POST /api/properties/:propertyId/documents/upload
Content-Type: multipart/form-data

file: <binary>
name: Insurance Document
category: INSURANCE
```

## API Endpoints

### Document Upload Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/properties/:id/documents/upload-url` | Get signed URL for property document |
| POST | `/leases/:id/documents/upload-url` | Get signed URL for lease document |
| POST | `/properties/:id/documents/upload` | Direct file upload |
| GET | `/documents/:id/download-url` | Get signed download URL |
| DELETE | `/documents/:id/with-file` | Delete document and S3 file |

### Existing Metadata Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/properties/:id/documents` | Create document metadata |
| GET | `/properties/:id/documents` | List property documents |
| GET | `/documents/:id` | Get document details |
| PATCH | `/documents/:id` | Update document metadata |
| DELETE | `/documents/:id` | Delete document (metadata only) |

## Storage Architecture

### Storage Provider Interface

The storage system uses an abstraction layer for easy switching between LocalStack and AWS:

```
StorageProvider (interface)
    ├── S3StorageProvider (current implementation)
    └── [Future: AwsS3StorageProvider for production]
```

### File Organization

Files are stored in S3 with the following structure:

```
s3://keynest-local-documents/
├── property/
│   └── {propertyId}/
│       └── {uuid}-{filename}
└── lease/
    └── {leaseId}/
        └── {uuid}-{filename}
```

## Migration to Real AWS

When deploying to production:

1. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://keynest-production-documents --region eu-central-1
   ```

2. **Configure CORS** (if using browser uploads)
   ```bash
   aws s3api put-bucket-cors --bucket keynest-production-documents --cors-configuration file://cors.json
   ```

3. **Update Environment Variables**
   ```env
   # Remove or comment out
   # AWS_ENDPOINT=http://localhost:4566

   # Set real credentials
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   S3_BUCKET_NAME=keynest-production-documents
   ```

4. **IAM Permissions**

   The application needs these S3 permissions:
   - `s3:PutObject`
   - `s3:GetObject`
   - `s3:DeleteObject`
   - `s3:HeadObject`

## Troubleshooting

### LocalStack Not Starting

```bash
# Check Docker status
docker ps

# Check LocalStack logs
docker logs keynest-localstack

# Restart LocalStack
npm run localstack:stop
npm run localstack:start
```

### Bucket Not Found

```bash
# Reinitialize buckets
docker exec keynest-localstack /etc/localstack/init/ready.d/init-aws.sh
```

### Connection Refused

- Ensure LocalStack is running: `docker ps | grep localstack`
- Check endpoint in `.env`: `AWS_ENDPOINT=http://localhost:4566`
- Verify port is not blocked by firewall

### CORS Errors in Browser

The bucket is configured with permissive CORS for development. If issues persist:

```bash
# Re-apply CORS configuration
docker exec keynest-localstack awslocal s3api put-bucket-cors \
  --bucket keynest-local-documents \
  --cors-configuration '{"CORSRules":[{"AllowedHeaders":["*"],"AllowedMethods":["GET","PUT","POST","DELETE","HEAD"],"AllowedOrigins":["*"]}]}'
```

## Data Persistence

LocalStack data is persisted in a Docker volume (`localstack-data`). To reset:

```bash
# Stop and remove volumes
docker-compose -f docker-compose.localstack.yml down -v

# Restart
npm run localstack:start
```

## Resources

- [LocalStack Documentation](https://docs.localstack.cloud/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
