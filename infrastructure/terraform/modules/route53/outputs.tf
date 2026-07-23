# Route53 module — outputs.

output "zone_id" {
  description = "Hosted zone ID — pass to modules that manage records in this zone (e.g. notifications for SES DKIM)."
  value       = aws_route53_zone.this.zone_id
}

output "name_servers" {
  description = "Zone name servers (must match the domain's NS delegation — they do when the zone was imported from registration)."
  value       = aws_route53_zone.this.name_servers
}
