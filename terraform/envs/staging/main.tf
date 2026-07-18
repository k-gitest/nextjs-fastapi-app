# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 乱数生成（内部認証トークン）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# FastAPI用のシークレットキー
resource "random_password" "secret_key" {
  length  = 64
  special = false

  lifecycle {
    ignore_changes = [length, special]
  }
}

# 内部認証トークン
resource "random_password" "internal_api_secret" {
  length  = 32
  special = false # hex文字列として使うためspecialなし

  lifecycle {
    ignore_changes = [length, special]
  }
}

# Auth0のセッション暗号化キー
resource "random_password" "auth0_secret" {
  length  = 32
  special = false

  lifecycle {
    ignore_changes = [length, special]
  }
}

# E2Eテスト用のダミーパスワード
resource "random_password" "e2e_test_password" {
  length  = 16
  special = false

  lifecycle {
    ignore_changes = [length, special]
  }
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Modules の呼び出し
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# --- Database (Neon) ---
module "neon" {
  source       = "../../modules/neon"
  project_name = local.neon_project_name
  branch_name  = "main"
  region_id    = var.neon_region
}

# --- Storage (Backblaze B2) ---
module "backblaze" {
  source          = "../../modules/backblaze"
  bucket_name     = local.backblaze_bucket_name
  bucket_type     = "allPrivate"
  allowed_origins = [local.render_web_url]
  region          = local.backblaze_region
}

# --- Cache & Vector & Queue (Upstash) ---
module "upstash" {
  source      = "../../modules/upstash"
  environment = local.environment
}

# --- Auth0 ---
# NOTE: auth0 provider の認証情報は Terraform Cloud Variables に設定
# AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET (Management API用)
/*
module "auth0" {
  source       = "../../modules/auth0"
  app_name     = local.project_name
  environment  = local.environment
  # Renderのサービス名は {app_name}-web なのでURLを先に計算
  web_base_url = "https://${local.render_app_name}-web.onrender.com"
  auth0_domain          = var.auth0_domain
}
*/

# --- Backend & Worker (Render) ---
module "render" {
  source          = "../../modules/render"
  owner_id        = var.render_owner_id
  app_name        = local.render_app_name
  environment     = local.environment
  github_repo_url = var.github_repo_url
  branch          = "staging"
  region          = var.render_region

  # DB
  database_url = module.neon.connection_uri

  # Auth0
  auth0_secret          = random_password.auth0_secret.result
  auth0_issuer_base_url = var.auth0_domain
  auth0_client_id       = var.auth0_client_id
  auth0_client_secret   = var.auth0_client_secret
  auth0_domain          = var.auth0_domain

  # 内部認証
  secret_key          = random_password.secret_key.result
  internal_api_secret = random_password.internal_api_secret.result

  # Upstash
  upstash_redis_rest_url     = module.upstash.redis_rest_url
  upstash_redis_rest_token   = module.upstash.redis_rest_token
  upstash_vector_endpoint    = module.upstash.vector_endpoint
  upstash_vector_token       = module.upstash.vector_token
  qstash_token               = var.qstash_token
  qstash_current_signing_key = var.qstash_current_signing_key
  qstash_next_signing_key    = var.qstash_next_signing_key
  qstash_url                 = var.qstash_url

  # Backblaze B2
  b2_application_key_id = module.backblaze.application_key_id
  b2_application_key    = module.backblaze.application_key
  b2_region             = local.backblaze_region
  s3_bucket_name        = module.backblaze.bucket_name
  s3_endpoint           = module.backblaze.s3_endpoint

  # 外部サービス
  gemini_api_key   = var.gemini_api_key
  resend_api_key   = var.resend_api_key
  motherduck_token = var.motherduck_token

  # Sentry
  web_env_vars    = { "SENTRY_DSN" = var.sentry_dsn_web }
  api_env_vars    = { "SENTRY_DSN" = var.sentry_dsn_api }
  worker_env_vars = { "SENTRY_DSN" = var.sentry_dsn_worker }
}

# --- GitHub Secrets/Variables ---
module "github_secrets" {
  source = "../../modules/github"

  repository_name = local.github_repository
  environment     = local.environment

  # URL
  web_url = module.render.web_service_url
  api_url = module.render.api_service_url

  # DB
  database_url = module.neon.connection_uri
  pghost       = module.neon.host
  pguser       = module.neon.role_name
  pgpassword   = module.neon.password
  pgdatabase   = module.neon.database_name

  # Auth0
  auth0_secret          = random_password.auth0_secret.result
  auth0_issuer_base_url = var.auth0_domain
  auth0_client_id       = var.auth0_client_id
  auth0_client_secret   = var.auth0_client_secret
  auth0_domain          = var.auth0_domain

  # 内部認証
  secret_key          = random_password.secret_key.result
  internal_api_secret = random_password.internal_api_secret.result

  # Upstash
  upstash_redis_rest_url     = module.upstash.redis_rest_url
  upstash_redis_rest_token   = module.upstash.redis_rest_token
  upstash_vector_endpoint    = module.upstash.vector_endpoint
  upstash_vector_token       = module.upstash.vector_token
  qstash_token               = var.qstash_token
  qstash_current_signing_key = var.qstash_current_signing_key
  qstash_next_signing_key    = var.qstash_next_signing_key

  # Backblaze B2
  b2_application_key_id = module.backblaze.application_key_id
  b2_application_key    = module.backblaze.application_key
  b2_region             = local.backblaze_region
  s3_bucket_name        = module.backblaze.bucket_name
  s3_endpoint           = module.backblaze.s3_endpoint

  # 外部サービス
  gemini_api_key   = var.gemini_api_key
  resend_api_key   = var.resend_api_key
  motherduck_token = var.motherduck_token

  # E2Eテスト
  e2e_test_email    = var.e2e_test_email
  e2e_test_password = random_password.e2e_test_password.result
}

# --- Sentry ---
/*
module "sentry" {
  source = "../../modules/sentry"

  environment         = local.environment
  sentry_organization = var.sentry_organization
  sentry_team         = var.sentry_team
}
*/