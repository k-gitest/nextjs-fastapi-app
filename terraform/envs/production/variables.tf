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
    error_message = "Neon region must use AWS format."
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

variable "e2e_test_email" {
  description = "E2E test user email (Auth0 に事前登録したテスト用アカウント)"
  type        = string
  default     = "e2e-test@example.com"

  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.e2e_test_email))
    error_message = "Must be a valid email address."
  }
}

variable "sentry_organization" {
  description = "Sentry organization slug"
  type        = string
}

variable "sentry_team" {
  description = "Sentry team slug"
  type        = string
}