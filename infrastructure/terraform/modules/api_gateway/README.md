# Module: api_gateway

**Status:** placeholder — not implemented yet.

Managed HTTP entry point for serverless surfaces. The primary NestJS API is
expected to run on ECS Fargate behind an ALB; this module covers API Gateway
where a serverless (Lambda-backed) surface is the better fit.

## Planned resources
- HTTP API (API Gateway v2) or REST API
- Routes / integrations (Lambda or private ALB via VPC link)
- Stages, throttling, access logging to CloudWatch
- Custom domain + ACM certificate

## Expected inputs
`name_prefix`, `tags`, `routes`, `domain_name`, `certificate_arn`

## Expected outputs
`api_endpoint`, `api_id`
