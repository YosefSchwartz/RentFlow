# Module: acm

**Status:** placeholder — not implemented yet.

TLS certificates for HTTPS endpoints (API, CDN, custom domains).

## Planned resources
- ACM certificate(s) with DNS validation via the `route53` module
- Note: RentFlow deploys in `eu-central-1`, **but** certificates used by
  CloudFront must be created in `us-east-1` (AWS requirement) — use a
  us-east-1 provider alias for those.

## Expected inputs
`tags`, `domain_name`, `subject_alternative_names`, `route53_zone_id`

## Expected outputs
`certificate_arn`
