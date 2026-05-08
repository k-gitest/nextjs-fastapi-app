# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GitHub モジュール - 変数定義
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "repository_name" {
  description = "GitHub repository name (e.g., username/nextjs-fastapi-app)"
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

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# URL設定
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "web_url" {
  description = "Next.js web service URL (from Render)"
  type        = string
}

variable "api_url" {
  description = "FastAPI service URL (from Render)"
  type        = string
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DB / Prisma
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "database_url" {
  description = "Prisma DATABASE_URL (from Neon)"
  type        = string
  sensitive   = true
}

variable "pghost" {
  type = string
}

variable "pguser" {
  type = string
}

variable "pgpassword" {
  type      = string
  sensitive = true
}

variable "pgdatabase" {
  type = string
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Auth0
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "auth0_secret" {
  type      = string
  sensitive = true
}

variable "auth0_client_id" {
  type = string
}

variable "auth0_client_secret" {
  type      = string
  sensitive = true
}

variable "auth0_issuer_base_url" {
  type = string
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 内部認証
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "internal_api_secret" {
  type      = string
  sensitive = true
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Upstash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "upstash_redis_rest_url" {
  type      = string
  sensitive = true
}

variable "upstash_redis_rest_token" {
  type      = string
  sensitive = true
}

variable "upstash_vector_endpoint" {
  type      = string
  sensitive = true
}

variable "upstash_vector_token" {
  type      = string
  sensitive = true
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

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Backblaze B2
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "b2_application_key_id" {
  type      = string
  sensitive = true
}

variable "b2_application_key" {
  type      = string
  sensitive = true
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 外部サービス
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "gemini_api_key" {
  type      = string
  sensitive = true
}

variable "resend_api_key" {
  type      = string
  sensitive = true
}

variable "motherduck_token" {
  type      = string
  sensitive = true
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# E2Eテスト用
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "e2e_test_email" {
  type      = string
  sensitive = true
}

variable "e2e_test_password" {
  type      = string
  sensitive = true
}
