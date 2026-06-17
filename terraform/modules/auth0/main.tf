# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Auth0 モジュール - リソース定義
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

terraform {
  required_providers {
    auth0 = {
      source  = "auth0/auth0"
      version = "~> 1.0"
    }
  }
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Auth0 Application (Regular Web App)
# @auth0/nextjs-auth0 v4 用
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

resource "auth0_client" "web" {
  name        = "${var.app_name}-${var.environment}"
  description = "Next.js web application (${var.environment})"
  app_type    = "regular_web"

  # @auth0/nextjs-auth0 が使用するコールバックURL
  callbacks = [
    "${var.web_base_url}/auth/callback",
  ]

  # ログアウト後のリダイレクト先
  allowed_logout_urls = [
    var.web_base_url,
  ]

  # CORS設定
  web_origins = [
    var.web_base_url,
  ]

  # JWT設定
  jwt_configuration {
    alg = "RS256"
  }

  # リフレッシュトークン（Rolling Session の代替）
  refresh_token {
    rotation_type   = "rotating"
    expiration_type = "expiring"
    token_lifetime  = 2592000 # 絶対有効期限: 30日
    # 非アクティブ時の有効期限: 7日
    idle_token_lifetime          = 604800
    infinite_token_lifetime      = false
    infinite_idle_token_lifetime = false
    leeway                       = 0
  }
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Auth0 Resource Server (API)
# FastAPI の内部APIとは別に、将来的なAPI認可用
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

resource "auth0_resource_server" "api" {
  name        = "${var.app_name}-api-${var.environment}"
  identifier  = "${var.web_base_url}/api"
  signing_alg = "RS256"

  # アクセストークンの有効期限 (秒)
  token_lifetime = 86400 # 24時間
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Auth0 テナントの基本設定
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

resource "auth0_tenant" "main" {
  friendly_name     = "${var.app_name} (${var.environment})"
  default_directory = "Username-Password-Authentication"

  # セッション設定
  # NOTE: proxy.ts で auth0.middleware() を /auth/* のみに限定しているため
  # Rolling Session は無効化されている（Issue #2335 workaround）
  # セッション有効期限はここで固定管理する
  session_lifetime      = 168 # 7日間 (時間単位)
  idle_session_lifetime = 72  # 3日間 (時間単位)
}
