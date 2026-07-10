# ============================================================================
# Identity (Layer 5) — Amazon Cognito user pool + mobile app client.
# ============================================================================
# Provisions managed authentication for the iOS/Android apps and (via OIDC)
# future backend services. Creates NO IAM users, app credentials, or backend
# permissions.
#
# No Cognito groups are created: RentFlow users have NO roles — authorization
# derives from ownership and active-lease relationships (see CLAUDE.md). Groups
# would model roles the domain does not have, so they are intentionally omitted.
# ----------------------------------------------------------------------------

resource "aws_cognito_user_pool" "this" {
  name = "${var.name_prefix}-users"

  # --- Email-based sign-in + verification ---
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  username_configuration {
    case_sensitive = false # emails are case-insensitive; prevents duplicate accounts
  }

  # Self-service sign-up (mobile), not admin-only.
  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  # --- Strong password policy ---
  password_policy {
    minimum_length                   = var.password_min_length
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  # --- Account recovery via verified email only (no SMS) ---
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # --- MFA (TOTP / software token; no SMS) ---
  mfa_configuration = var.mfa_configuration

  dynamic "software_token_mfa_configuration" {
    for_each = var.mfa_configuration == "OFF" ? [] : [1]
    content {
      enabled = true
    }
  }

  # --- Threat protection (adaptive auth / compromised-credential detection) ---
  user_pool_add_ons {
    advanced_security_mode = var.advanced_security_mode
  }

  # Cognito-managed email for now (SES for higher volume / custom templates later).
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  deletion_protection = var.deletion_protection ? "ACTIVE" : "INACTIVE"

  tags = merge(var.tags, { Name = "${var.name_prefix}-users" })
}

# --- Mobile app client (public: no secret) ----------------------------------
resource "aws_cognito_user_pool_client" "mobile" {
  name         = "${var.name_prefix}-mobile"
  user_pool_id = aws_cognito_user_pool.this.id

  # Public client — mobile apps cannot keep a secret.
  generate_secret = false

  # SRP (password never leaves the device) + refresh. No plaintext USER_PASSWORD_AUTH.
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  # Return generic errors so sign-in/up cannot be used to enumerate accounts.
  prevent_user_existence_errors = "ENABLED"

  # Allow logout / global sign-out to revoke refresh tokens.
  enable_token_revocation = true

  # Token lifetimes (mirror the app: 15m access/id, 30d refresh).
  access_token_validity  = var.access_token_validity_minutes
  id_token_validity      = var.id_token_validity_minutes
  refresh_token_validity = var.refresh_token_validity_days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  supported_identity_providers = ["COGNITO"]

  # Hosted-UI / OAuth flows are intentionally not enabled — the apps use SRP
  # directly. The pool is still a full OIDC issuer, so backend services can
  # validate JWTs via the discovery endpoint without hosted UI.
}
