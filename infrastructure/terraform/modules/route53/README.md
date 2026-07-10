# Module: route53

**Status:** placeholder — not implemented yet.

DNS for RentFlow domains.

## Planned resources
- Hosted zone(s) (or records in an existing zone)
- A/AAAA alias records for CloudFront / API Gateway / ALB
- ACM DNS-validation records (consumed by the `acm` module)

## Expected inputs
`tags`, `zone_name`, `records`

## Expected outputs
`zone_id`, `name_servers`
