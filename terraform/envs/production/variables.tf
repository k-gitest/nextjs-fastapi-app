# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Production環境 - 変数定義
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "nextjs-fastapi-app"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging"], var.environment)
    error_message = "Environment must be 'production' or 'staging'."
  }
}

variable "render_owner_id" {
  description = "Render Owner ID (usr-xxx or tea-xxx)"
  type        = string
}

variable "github_repo_url" {
  description = "GitHub repository URL (HTTPS format)"
  type        = string
}

variable "neon_region" {
  description = "Neon database region (AWS format)"
  type        = string
  default     = "aws-ap-southeast-1"

  validation {
    condition     = can(regex("^aws-", var.neon_region))
    error_message = "Neon region must use AWS format (e.g., aws-ap-southeast-1)."
  }
}

variable "render_region" {
  description = "Render deployment region"
  type        = string
  default     = "singapore"

  validation {
    condition = contains([
      "oregon", "ohio", "virginia", "frankfurt", "singapore"
    ], var.render_region)
    error_message = "Must be a valid Render region."
  }
}

variable "gemini_api_key" {
  type      = string
  sensitive = true
}

variable "resend_api_key" {
  type      = string
  sensitive = true
}

variable "motherduck_token" {
  description = "MotherDuck (DuckDB) access token"
  type        = string
  sensitive   = true
}

variable "auth0_domain" {
  description = "auth0 domain (issuer_base_url) "
  type        = string
}

variable "auth0_client_id" {
  description = "AUTH0_CLIENT_ID"
  type        = string
}

variable "auth0_client_secret" {
  description = "AUTH0_CLIENT_SECRET"
  type        = string
}

variable "e2e_test_email" {
  description = "E2E test user email (Auth0 に事前登録したテスト用アカウント)"
  type        = string
  default     = "e2e-test@example.com"

  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.e2e_test_email))
    error_message = "Must be a valid email address."
  }
}
/*
variable "sentry_organization" {
  description = "Sentry organization slug"
  type        = string
}
*/
/*
variable "sentry_team" {
  description = "Sentry team slug"
  type        = string
}
*/

variable "sentry_dsn_web" {
  description = "Sentry DSN"
  type        = string
  sensitive   = true
  default     = ""
}

variable "sentry_dsn_api" {
  type      = string
  sensitive = true
  default   = ""
}

variable "sentry_dsn_worker" {
  type      = string
  sensitive = true
  default   = ""
}

variable "sentry_org" {
  description = "Sentry Organization"
  type        = string
}

variable "sentry_project" {
  description = "Sentry Project Name"
  type        = string
}

variable "qstash_token" {
  type      = string
  sensitive = true
}

variable "qstash_current_signing_key" {
  type      = string
  sensitive = true
}

variable "qstash_next_signing_key" {
  type      = string
  sensitive = true
}

variable "qstash_url" {
  description = "qstash base url"
  type        = string
}