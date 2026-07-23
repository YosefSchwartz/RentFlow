# ============================================================================
# Route53 (Layer 13) — public DNS for the registered domain.
# ============================================================================
# The hosted zone is AUTO-CREATED by Route53 Domains at registration and then
# IMPORTED into this resource:
#
#   tofu import 'module.dns.aws_route53_zone.this' <ZONE_ID>
#
# Importing (instead of creating a second zone) keeps the domain's NS
# delegation untouched while making every record IaC-managed. SES records
# (DKIM/SPF/DMARC) live in the notifications module, which owns the identity;
# this module owns the zone itself and the site records.
# ----------------------------------------------------------------------------

resource "aws_route53_zone" "this" {
  name    = var.domain_name
  comment = "${var.name_prefix} public zone (managed by OpenTofu)"

  tags = merge(var.tags, { Name = "${var.name_prefix}-zone" })
}

# --- GitHub Pages landing site (apex + www) ---------------------------------
# GitHub's published, stable anycast addresses for Pages apex domains:
# https://docs.github.com/en/pages/configuring-a-custom-domain
resource "aws_route53_record" "pages_a" {
  count = var.enable_github_pages ? 1 : 0

  zone_id = aws_route53_zone.this.zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [
    "185.199.108.153",
    "185.199.109.153",
    "185.199.110.153",
    "185.199.111.153",
  ]
}

resource "aws_route53_record" "pages_aaaa" {
  count = var.enable_github_pages ? 1 : 0

  zone_id = aws_route53_zone.this.zone_id
  name    = var.domain_name
  type    = "AAAA"
  ttl     = 300
  records = [
    "2606:50c0:8000::153",
    "2606:50c0:8001::153",
    "2606:50c0:8002::153",
    "2606:50c0:8003::153",
  ]
}

resource "aws_route53_record" "pages_www" {
  count = var.enable_github_pages && var.github_pages_hostname != null ? 1 : 0

  zone_id = aws_route53_zone.this.zone_id
  name    = "www.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.github_pages_hostname]
}
