# Networking module — subnet plan.

locals {
  # The AZs we spread across (first N of the region's available AZs).
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  # Predictable /24 allocation inside the /16, grouped by tier with headroom:
  #
  #   tier          offset   AZ-a          AZ-b          reserved slots
  #   ------------  -------  ------------  ------------  ---------------
  #   public          0      10.x.0.0/24   10.x.1.0/24   0-15
  #   private (app)  16      10.x.16.0/24  10.x.17.0/24  16-31
  #   private (db)   32      10.x.32.0/24  10.x.33.0/24  32-47
  #
  # Each tier owns a 16-block range, so AZs or subnets can be added later
  # without renumbering. Maps are keyed by AZ for stable, addressable resources.
  public_subnets      = { for i, az in local.azs : az => cidrsubnet(var.vpc_cidr, 8, 0 + i) }
  private_app_subnets = { for i, az in local.azs : az => cidrsubnet(var.vpc_cidr, 8, 16 + i) }
  private_db_subnets  = { for i, az in local.azs : az => cidrsubnet(var.vpc_cidr, 8, 32 + i) }
}
