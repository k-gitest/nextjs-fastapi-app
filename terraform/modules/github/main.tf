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
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "DATABASE_URL"
  value       = var.database_url
}

# prisma migrate deploy 用に個別接続情報も管理
resource "github_actions_environment_secret" "pghost" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "PGHOST"
  value       = var.pghost
}

resource "github_actions_environment_secret" "pguser" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "PGUSER"
  value       = var.pguser
}

resource "github_actions_environment_secret" "pgpassword" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "PGPASSWORD"
  value       = var.pgpassword
}

resource "github_actions_environment_secret" "pgdatabase" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "PGDATABASE"
  value       = var.pgdatabase
}

# --- アプリ固有の暗号化シークレット (SECRET_KEY を追加) ---

resource "github_actions_environment_secret" "secret_key" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "SECRET_KEY"
  value       = var.secret_key
}

# --- Auth0 ---

resource "github_actions_environment_secret" "auth0_secret" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "AUTH0_SECRET"
  value       = var.auth0_secret
}

resource "github_actions_environment_secret" "auth0_client_id" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "AUTH0_CLIENT_ID"
  value       = var.auth0_client_id
}

resource "github_actions_environment_secret" "auth0_client_secret" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "AUTH0_CLIENT_SECRET"
  value       = var.auth0_client_secret
}

resource "github_actions_environment_secret" "auth0_issuer_base_url" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "AUTH0_ISSUER_BASE_URL"
  value       = var.auth0_issuer_base_url
}

resource "github_actions_environment_secret" "auth0_domain" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "AUTH0_DOMAIN"
  value       = var.auth0_domain
}

# --- 内部認証 ---

resource "github_actions_environment_secret" "internal_api_secret" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "INTERNAL_API_SECRET"
  value       = var.internal_api_secret
}

# --- Upstash ---

resource "github_actions_environment_secret" "upstash_redis_rest_url" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "UPSTASH_REDIS_REST_URL"
  value       = var.upstash_redis_rest_url
}

resource "github_actions_environment_secret" "upstash_redis_rest_token" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "UPSTASH_REDIS_REST_TOKEN"
  value       = var.upstash_redis_rest_token
}

resource "github_actions_environment_secret" "upstash_vector_rest_url" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "UPSTASH_VECTOR_REST_URL"
  value       = var.upstash_vector_endpoint
}

resource "github_actions_environment_secret" "upstash_vector_rest_token" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "UPSTASH_VECTOR_REST_TOKEN"
  value       = var.upstash_vector_token
}

resource "github_actions_environment_secret" "qstash_token" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "QSTASH_TOKEN"
  value       = var.qstash_token
}

resource "github_actions_environment_secret" "qstash_current_signing_key" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "QSTASH_CURRENT_SIGNING_KEY"
  value       = var.qstash_current_signing_key
}

resource "github_actions_environment_secret" "qstash_next_signing_key" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "QSTASH_NEXT_SIGNING_KEY"
  value       = var.qstash_next_signing_key
}

# --- Backblaze B2 ---

resource "github_actions_environment_secret" "b2_key_id" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "B2_KEY_ID"
  value       = var.b2_application_key_id
}

resource "github_actions_environment_secret" "b2_application_key" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "B2_APPLICATION_KEY"
  value       = var.b2_application_key
}

resource "github_actions_environment_secret" "b2_region" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "B2_REGION"
  value       = var.b2_region
}

resource "github_actions_environment_secret" "s3_bucket_name" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "B2_BUCKET"
  value       = var.s3_bucket_name
}

resource "github_actions_environment_secret" "s3_endpoint" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "B2_ENDPOINT"
  value       = var.s3_endpoint
}

# --- 外部サービス ---

resource "github_actions_environment_secret" "gemini_api_key" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "GEMINI_API_KEY"
  value       = var.gemini_api_key
}

resource "github_actions_environment_secret" "resend_api_key" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "RESEND_API_KEY"
  value       = var.resend_api_key
}

resource "github_actions_environment_secret" "motherduck_token" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "MOTHERDUCK_TOKEN"
  value       = var.motherduck_token
}

# --- E2Eテスト用 ---

resource "github_actions_environment_secret" "e2e_test_email" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "E2E_TEST_EMAIL"
  value       = var.e2e_test_email
}

resource "github_actions_environment_secret" "e2e_test_password" {
  repository  = var.repository_name
  environment = github_repository_environment.main.environment
  secret_name = "E2E_TEST_PASSWORD"
  value       = var.e2e_test_password
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ブランチ保護ルール
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NOTE: terraform apply 前に以下を確認すること
# 1. repository_id に渡す repository_name が "repo-name" 形式であること
#    "username/repo-name" 形式だと失敗する場合がある
# 2. contexts の文字列が GitHub PR画面で表示される実際のcheck名と完全一致すること
/*
resource "github_branch_protection" "main" {
  repository_id = var.repository_name
  pattern       = "main"

  required_status_checks {
    strict = true
    # TODO: apply前にGitHub PR画面で実際のcheck名を確認して修正すること
    contexts = [
      "Next.js Test (staging)",
      "FastAPI Test (staging)",
      "Worker Test (staging)",
    ]
  }

  required_pull_request_reviews {
    dismiss_stale_reviews           = true
    required_approving_review_count = 1
  }

  enforce_admins = false
}
*/
/*
resource "github_branch_protection" "develop" {
  repository_id = var.repository_name
  pattern       = "develop"

  required_status_checks {
    strict = true
    # TODO: apply前にGitHub PR画面で実際のcheck名を確認して修正すること
    contexts = [
      "Next.js Test (staging)",
      "FastAPI Test (staging)",
      "Worker Test (staging)",
    ]
  }

  required_pull_request_reviews {
    dismiss_stale_reviews           = true
    required_approving_review_count = 1
  }

  enforce_admins = false
}
*/