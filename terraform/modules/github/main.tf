# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GitHub Secrets/Variables 管理モジュール
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

terraform {
  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GitHub Environment 作成
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

resource "github_repository_environment" "main" {
  repository  = var.repository_name
  environment = var.environment
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Environment Variables（公開情報）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Next.js web サービスURL（CI/CDデプロイ確認用）
resource "github_actions_environment_variable" "web_url" {
  repository    = var.repository_name
  environment   = github_repository_environment.main.environment
  variable_name = "WEB_URL"
  value         = var.web_url
}

# FastAPI サービスURL（CI/CDデプロイ確認用）
resource "github_actions_environment_variable" "api_url" {
  repository    = var.repository_name
  environment   = github_repository_environment.main.environment
  variable_name = "API_URL"
  value         = var.api_url
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Environment Secrets（機密情報）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# --- Prisma / DB ---

resource "github_actions_environment_secret" "database_url" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "DATABASE_URL"
  plaintext_value = var.database_url
}

# prisma migrate deploy 用に個別接続情報も管理
resource "github_actions_environment_secret" "pghost" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "PGHOST"
  plaintext_value = var.pghost
}

resource "github_actions_environment_secret" "pguser" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "PGUSER"
  plaintext_value = var.pguser
}

resource "github_actions_environment_secret" "pgpassword" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "PGPASSWORD"
  plaintext_value = var.pgpassword
}

resource "github_actions_environment_secret" "pgdatabase" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "PGDATABASE"
  plaintext_value = var.pgdatabase
}

# --- Auth0 ---

resource "github_actions_environment_secret" "auth0_secret" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "AUTH0_SECRET"
  plaintext_value = var.auth0_secret
}

resource "github_actions_environment_secret" "auth0_client_id" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "AUTH0_CLIENT_ID"
  plaintext_value = var.auth0_client_id
}

resource "github_actions_environment_secret" "auth0_client_secret" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "AUTH0_CLIENT_SECRET"
  plaintext_value = var.auth0_client_secret
}

resource "github_actions_environment_secret" "auth0_issuer_base_url" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "AUTH0_ISSUER_BASE_URL"
  plaintext_value = var.auth0_issuer_base_url
}

# --- 内部認証 ---

resource "github_actions_environment_secret" "internal_api_secret" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "INTERNAL_API_SECRET"
  plaintext_value = var.internal_api_secret
}

# --- Upstash ---

resource "github_actions_environment_secret" "upstash_redis_rest_url" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "UPSTASH_REDIS_REST_URL"
  plaintext_value = var.upstash_redis_rest_url
}

resource "github_actions_environment_secret" "upstash_redis_rest_token" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "UPSTASH_REDIS_REST_TOKEN"
  plaintext_value = var.upstash_redis_rest_token
}

resource "github_actions_environment_secret" "upstash_vector_rest_url" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "UPSTASH_VECTOR_REST_URL"
  plaintext_value = var.upstash_vector_endpoint
}

resource "github_actions_environment_secret" "upstash_vector_rest_token" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "UPSTASH_VECTOR_REST_TOKEN"
  plaintext_value = var.upstash_vector_token
}

resource "github_actions_environment_secret" "qstash_token" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "QSTASH_TOKEN"
  plaintext_value = var.qstash_token
}

resource "github_actions_environment_secret" "qstash_current_signing_key" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "QSTASH_CURRENT_SIGNING_KEY"
  plaintext_value = var.qstash_current_signing_key
}

resource "github_actions_environment_secret" "qstash_next_signing_key" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "QSTASH_NEXT_SIGNING_KEY"
  plaintext_value = var.qstash_next_signing_key
}

# --- Backblaze B2 ---

resource "github_actions_environment_secret" "aws_access_key_id" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "AWS_ACCESS_KEY_ID"
  plaintext_value = var.b2_application_key_id
}

resource "github_actions_environment_secret" "aws_secret_access_key" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "AWS_SECRET_ACCESS_KEY"
  plaintext_value = var.b2_application_key
}

# --- 外部サービス ---

resource "github_actions_environment_secret" "gemini_api_key" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "GEMINI_API_KEY"
  plaintext_value = var.gemini_api_key
}

resource "github_actions_environment_secret" "resend_api_key" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "RESEND_API_KEY"
  plaintext_value = var.resend_api_key
}

resource "github_actions_environment_secret" "motherduck_token" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "MOTHERDUCK_TOKEN"
  plaintext_value = var.motherduck_token
}

# --- E2Eテスト用 ---

resource "github_actions_environment_secret" "e2e_test_email" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "E2E_TEST_EMAIL"
  plaintext_value = var.e2e_test_email
}

resource "github_actions_environment_secret" "e2e_test_password" {
  repository      = var.repository_name
  environment     = github_repository_environment.main.environment
  secret_name     = "E2E_TEST_PASSWORD"
  plaintext_value = var.e2e_test_password
}
