# Module: lambda

**Status:** placeholder — not implemented yet.

Reusable AWS Lambda function primitive (e.g. Cognito triggers, scheduled jobs,
async media/notification processing).

## Planned resources
- Lambda function (packaged zip or container image)
- Execution IAM role (least privilege) + CloudWatch log group
- Optional VPC config, environment variables (secrets via Secrets Manager/SSM)

## Expected inputs
`name_prefix`, `tags`, `handler`, `runtime`, `source`, `environment`,
`vpc_config`, `policy_statements`

## Expected outputs
`function_arn`, `function_name`, `role_arn`
