# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Terraform Cloud Backend 設定（Staging）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

terraform {
  required_version = ">= 1.14.0, < 2.0.0"

  cloud {
    organization = "nextjs-fastapi-app"
    workspaces {
      name = "nextjs-fastapi-staging"
    }
  }

  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.3"
    }
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.6"
    }
    b2 = {
      source  = "Backblaze/b2"
      version = "~> 0.8"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
    auth0 = {
      source  = "auth0/auth0"
      version = "~> 1.0"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    sentry = {
      source  = "jianyuan/sentry"
      version = "~> 0.14.0"
    }
  }
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Provider 設定
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

provider "render" {
  owner_id = var.render_owner_id
}

provider "neon" {}

provider "b2" {}

provider "github" {}

provider "auth0" {
  # Auth0 Management API の認証情報
  # Terraform Cloud の Variables に設定する
  # AUTH0_DOMAIN / AUTH0_CLIENT_ID / AUTH0_CLIENT_SECRET
}

provider "upstash" {}

provider "sentry" {
  # SENTRY_AUTH_TOKEN 環境変数から自動読み込み
}