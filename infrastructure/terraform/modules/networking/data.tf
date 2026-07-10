# Discover the region's AZs at plan time so AZ names are never hardcoded.
data "aws_availability_zones" "available" {
  state = "available"
}

# Region is used to build VPC endpoint service names (never hardcoded).
data "aws_region" "current" {}
