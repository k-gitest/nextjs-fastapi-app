# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Auth0 モジュール - 変数定義
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "app_name" {
  description = "Application name (e.g., nextjs-fastapi-app)"
  type        = string
}

variable "environment" {
  description = "Environment name (staging or production)"
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

variable "web_base_url" {
  description = "Next.js web base URL (e.g., https://nextjs-fastapi-app-staging-web.onrender.com)"
  type        = string

  validation {
    condition     = can(regex("^https://", var.web_base_url))
    error_message = "web_base_url must start with https://."
  }
}
