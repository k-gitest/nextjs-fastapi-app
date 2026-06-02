# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sentry モジュール - リソース定義
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

terraform {
  required_providers {
    sentry = {
      source  = "jianyuan/sentry"
      version = "~> 0.14.0"
    }
  }
}

# --- Projects ---
resource "sentry_project" "web" {
  organization = var.sentry_organization
  teams        = [var.sentry_team]
  name         = "web-${var.environment}"
  slug         = "web-${var.environment}"
  platform     = "javascript-nextjs"
}

resource "sentry_project" "api" {
  organization = var.sentry_organization
  teams        = [var.sentry_team]
  name         = "api-${var.environment}"
  slug         = "api-${var.environment}"
  platform     = "python-fastapi"
}

resource "sentry_project" "worker" {
  organization = var.sentry_organization
  teams        = [var.sentry_team]
  name         = "worker-${var.environment}"
  slug         = "worker-${var.environment}"
  platform     = "node"
}

# --- Client Keys (DSN取得) ---
data "sentry_key" "web" {
  organization = var.sentry_organization
  project      = sentry_project.web.id
  first        = true
}

data "sentry_key" "api" {
  organization = var.sentry_organization
  project      = sentry_project.api.id
  first        = true
}

data "sentry_key" "worker" {
  organization = var.sentry_organization
  project      = sentry_project.worker.id
  first        = true
}