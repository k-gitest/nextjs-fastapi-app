# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Terraform Cloud Backend 設定（Production）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

terraform {
  required_version = ">= 1.14.0, < 2.0.0"

  cloud {
    organization = "nextjs-fastapi-app"
    workspaces {
      name = "nextjs-fastapi-production"
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
  }
}

provider "render" {
  owner_id = var.render_owner_id
}

provider "neon" {}
provider "b2" {}
provider "github" {}
provider "auth0" {}
provider "upstash" {}
