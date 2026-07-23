# Route53 module — inputs.
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

variable "domain_name" {
  description = "The registered domain this zone serves (e.g. rent-flow.dev)."
  type        = string
}

variable "enable_github_pages" {
  description = "Point the apex (A/AAAA) and www at GitHub Pages for the static landing site."
  type        = bool
  default     = false
}

variable "github_pages_hostname" {
  description = "GitHub Pages hostname for the www CNAME (e.g. <owner>.github.io). Null skips the www record."
  type        = string
  default     = null
}
