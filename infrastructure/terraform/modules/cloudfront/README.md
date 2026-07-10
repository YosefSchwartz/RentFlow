# Module: cloudfront

**Status:** placeholder — not implemented yet.

CDN in front of static/legal assets and (later) signed file downloads. Pairs
with the backend's reserved `STORAGE_PROVIDER=cloudfront` future path.

## Planned resources
- CloudFront distribution(s) with Origin Access Control (OAC) to private S3
- Cache/response-header policies
- Optional signed-URL / signed-cookie key group for private downloads
- ACM certificate (must be in us-east-1 for CloudFront, even though RentFlow
  deploys in eu-central-1) + Route53 alias records

## Expected inputs
`name_prefix`, `tags`, `origin_bucket`, `acm_certificate_arn`, `aliases`

## Expected outputs
`distribution_id`, `distribution_domain_name`
