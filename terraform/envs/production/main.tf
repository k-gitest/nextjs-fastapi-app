# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 乱数生成
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

resource "random_password" "internal_api_secret" {
  length  = 32
  special = false
  lifecycle { ignore_changes = [length, special] }
}

resource "random_password" "auth0_secret" {
  length  = 32
  special = false
  lifecycle { ignore_changes = [length, special] }
}

resource "random_password" "e2e_test_password" {
  length  = 16
  special = false
  lifecycle { ignore_changes = [length, special] }
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Modules の呼び出し（staging と同一構成）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

module "neon" {
  source       = "../../modules/neon"
  project_name = local.neon_project_name
  branch_name  = "main"
  region_id    = var.neon_region
}

module "backblaze" {
  source      = "../../modules/backblaze"
  bucket_name = local.backblaze_bucket_name
  bucket_type = "allPrivate"
}

module "upstash" {
  source      = "../../modules/upstash"
  environment = local.environment
}

module "auth0" {
  source       = "../../modules/auth0"
  app_name     = local.project_name
  environment  = local.environment
  web_base_url = "https://${local.render_app_name}-web.onrender.com"
}

module "render" {
  source          = "../../modules/render"
  owner_id        = var.render_owner_id
  app_name        = local.render_app_name
  environment     = local.environment
  github_repo_url = var.github_repo_url
  branch          = "main"
  region          = var.render_region

  database_url          = module.neon.connection_uri
  auth0_secret          = random_password.auth0_secret.result
  auth0_issuer_base_url = module.auth0.issuer_base_url
  auth0_client_id       = module.auth0.client_id
  auth0_client_secret   = module.auth0.client_secret
  internal_api_secret   = random_password.internal_api_secret.result

  upstash_redis_rest_url     = module.upstash.redis_rest_url
  upstash_redis_rest_token   = module.upstash.redis_rest_token
  upstash_vector_endpoint    = module.upstash.vector_endpoint
  upstash_vector_token       = module.upstash.vector_token
  qstash_token               = module.upstash.qstash_token
  qstash_current_signing_key = module.upstash.qstash_current_signing_key
  qstash_next_signing_key    = module.upstash.qstash_next_signing_key

  b2_application_key_id = module.backblaze.application_key_id
  b2_application_key    = module.backblaze.application_key
  s3_bucket_name        = module.backblaze.bucket_name
  s3_endpoint           = module.backblaze.s3_endpoint

  gemini_api_key   = var.gemini_api_key
  resend_api_key   = var.resend_api_key
  motherduck_token = var.motherduck_token

  # Sentry
  web_env_vars    = { "SENTRY_DSN" = module.sentry.web_dsn }
  api_env_vars    = { "SENTRY_DSN" = module.sentry.api_dsn }
  worker_env_vars = { "SENTRY_DSN" = module.sentry.worker_dsn }
}

module "github_secrets" {
  source = "../../modules/github"

  repository_name = local.github_repository
  environment     = local.environment

  web_url = module.render.web_service_url
  api_url = module.render.api_service_url

  database_url = module.neon.connection_uri
  pghost       = module.neon.host
  pguser       = module.neon.role_name
  pgpassword   = module.neon.password
  pgdatabase   = module.neon.database_name

  auth0_secret          = random_password.auth0_secret.result
  auth0_client_id       = module.auth0.client_id
  auth0_client_secret   = module.auth0.client_secret
  auth0_issuer_base_url = module.auth0.issuer_base_url

  internal_api_secret = random_password.internal_api_secret.result

  upstash_redis_rest_url     = module.upstash.redis_rest_url
  upstash_redis_rest_token   = module.upstash.redis_rest_token
  upstash_vector_endpoint    = module.upstash.vector_endpoint
  upstash_vector_token       = module.upstash.vector_token
  qstash_token               = module.upstash.qstash_token
  qstash_current_signing_key = module.upstash.qstash_current_signing_key
  qstash_next_signing_key    = module.upstash.qstash_next_signing_key

  b2_application_key_id = module.backblaze.application_key_id
  b2_application_key    = module.backblaze.application_key

  gemini_api_key   = var.gemini_api_key
  resend_api_key   = var.resend_api_key
  motherduck_token = var.motherduck_token

  e2e_test_email    = var.e2e_test_email
  e2e_test_password = random_password.e2e_test_password.result
}

# --- Sentry ---
module "sentry" {
  source = "../../modules/sentry"

  environment         = local.environment
  sentry_organization = var.sentry_organization
  sentry_team         = var.sentry_team
}