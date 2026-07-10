# Identity module — inputs.
#
# Naming and tags are CONSUMED from Foundation; the module defines none of its
# own. All security-relevant settings have secure defaults and are overridable.

variable "name_prefix" {
  description = "Resource-name prefix from Foundation (e.g. rentflow-staging)."
  type        = string
}

variable "tags" {
  description = "Standard tag set from Foundation (common_tags)."
  type        = map(string)
}

variable "password_min_length" {
  description = "Minimum password length. Policy also requires upper, lower, number, and symbol."
  type        = number
  default     = 12

  validation {
    condition     = var.password_min_length >= 8
    error_message = "password_min_length must be at least 8 (Cognito minimum); RentFlow default is 12."
  }
}

variable "mfa_configuration" {
  description = "MFA policy: OFF, OPTIONAL (user may enable TOTP), or ON (required)."
  type        = string
  default     = "OPTIONAL"

  validation {
    condition     = contains(["OFF", "OPTIONAL", "ON"], var.mfa_configuration)
    error_message = "mfa_configuration must be one of: OFF, OPTIONAL, ON."
  }
}

variable "advanced_security_mode" {
  description = "Cognito threat protection: OFF, AUDIT (log only), or ENFORCED (block risky sign-ins)."
  type        = string
  default     = "AUDIT"

  validation {
    condition     = contains(["OFF", "AUDIT", "ENFORCED"], var.advanced_security_mode)
    error_message = "advanced_security_mode must be one of: OFF, AUDIT, ENFORCED."
  }
}

variable "access_token_validity_minutes" {
  description = "Access token lifetime in minutes (mirrors the app's 15-minute access tokens)."
  type        = number
  default     = 15
}

variable "id_token_validity_minutes" {
  description = "ID token lifetime in minutes."
  type        = number
  default     = 15
}

variable "refresh_token_validity_days" {
  description = "Refresh token lifetime in days (mirrors the app's 30-day refresh tokens)."
  type        = number
  default     = 30
}

variable "deletion_protection" {
  description = "Protect the user pool from accidental deletion."
  type        = bool
  default     = true
}
