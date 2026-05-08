# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Render モジュール - 変数定義
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "owner_id" {
  description = "Render Owner ID (usr-xxx or tea-xxx)"
  type        = string

  validation {
    condition     = can(regex("^(usr|tea)-", var.owner_id))
    error_message = "Owner ID must start with 'usr-' or 'tea-'."
  }
}

variable "app_name" {
  description = "Base app name (e.g., nextjs-fastapi-app-staging). サービス名のプレフィックスとして使用"
  type        = string
}

variable "environment" {
  description = "Environment name (staging or production)"
  type        = string
}

variable "github_repo_url" {
  description = "GitHub repository URL (HTTPS format)"
  type        = string

  validation {
    condition     = can(regex("^https://github\\.com/", var.github_repo_url))
    error_message = "GitHub URL must be in HTTPS format."
  }
}

variable "branch" {
  description = "Git branch to deploy"
  type        = string
  default     = "main"
}

variable "region" {
  description = "Render deployment region"
  type        = string

  validation {
    condition = contains([
      "oregon", "ohio", "virginia", "frankfurt", "singapore"
    ], var.region)
    error_message = "Must be a valid Render region."
  }
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DB
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "database_url" {
  description = "Prisma DATABASE_URL (from Neon)"
  type        = string
  sensitive   = true
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Auth0
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "auth0_secret" {
  description = "AUTH0_SECRET (openssl rand -hex 32 で生成)"
  type        = string
  sensitive   = true
}

variable "auth0_issuer_base_url" {
  description = "AUTH0_ISSUER_BASE_URL (e.g., https://your-tenant.auth0.com)"
  type        = string
}

variable "auth0_client_id" {
  description = "AUTH0_CLIENT_ID"
  type        = string
}

variable "auth0_client_secret" {
  description = "AUTH0_CLIENT_SECRET"
  type        = string
  sensitive   = true
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 内部認証
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "internal_api_secret" {
  description = "INTERNAL_API_SECRET (Next.js ↔ FastAPI セマンティック検索用)"
  type        = string
  sensitive   = true
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
  description = "QStash current signing key (FastAPI webhook 署名検証用)"
  type        = string
  sensitive   = true
}

variable "qstash_next_signing_key" {
  description = "QStash next signing key (ローテーション用)"
  type        = string
  sensitive   = true
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

variable "s3_bucket_name" {
  type = string
}

variable "s3_endpoint" {
  type = string
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
  description = "MotherDuck (DuckDB) access token"
  type        = string
  sensitive   = true
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 追加環境変数（サービスごとに上書き可能）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "web_env_vars" {
  description = "Additional env vars for Next.js web service"
  type        = map(string)
  default     = {}
}

variable "api_env_vars" {
  description = "Additional env vars for FastAPI service"
  type        = map(string)
  default     = {}
}

variable "worker_env_vars" {
  description = "Additional env vars for Node.js worker"
  type        = map(string)
  default     = {}
}
