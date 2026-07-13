# Networking module — inputs.
#
# Naming and tags are CONSUMED from the Foundation module (passed in by the
# root). This module never defines project/tag values of its own.

variable "name_prefix" {
  description = "Resource-name prefix from Foundation (e.g. rentflow-staging)."
  type        = string
}

variable "tags" {
  description = "Standard tag set from Foundation (common_tags). Applied to every resource."
  type        = map(string)
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC. Use a distinct /16 per environment to keep future peering possible."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr must be a valid IPv4 CIDR block."
  }
}

variable "az_count" {
  description = "Number of Availability Zones to spread subnets across."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "az_count must be 2 or 3 (eu-central-1 has three AZs; two are required for HA)."
  }
}

variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames in the VPC (required for private RDS endpoints, VPC endpoints, etc.)."
  type        = bool
  default     = true
}

variable "additional_interface_endpoints" {
  description = "Extra interface VPC endpoints to create (key => AWS service short-name), merged with the base set. E.g. { ssmmessages = \"ssmmessages\" } to allow ECS Exec on tasks in private subnets with no NAT."
  type        = map(string)
  default     = {}
}

variable "enable_db_internet_route" {
  description = "Add a 0.0.0.0/0 -> IGW route to the DATABASE route table, making the DB subnets internet-routable. Keep FALSE (the DB tier is isolated by default); enable ONLY for temporary, SG-restricted developer access (e.g. DataGrip). Reachability is still gated by the DB security group."
  type        = bool
  default     = false
}
