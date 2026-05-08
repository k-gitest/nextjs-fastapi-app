# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Staging環境 - 出力値
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

output "environment" {
  description = "Environment name"
  value       = local.environment
}

output "project_name" {
  description = "Project name"
  value       = local.project_name
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Neon
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

output "neon_project_id" {
  value = module.neon.project_id
}

output "neon_database_host" {
  value = module.neon.host
}

output "neon_connection_uri" {
  value     = module.neon.connection_uri
  sensitive = true
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Render
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

output "web_service_url" {
  description = "Next.js web service URL"
  value       = module.render.web_service_url
}

output "api_service_url" {
  description = "FastAPI service URL"
  value       = module.render.api_service_url
}

output "worker_service_id" {
  description = "Background worker service ID"
  value       = module.render.worker_service_id
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Auth0
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

output "auth0_client_id" {
  description = "Auth0 Client ID"
  value       = module.auth0.client_id
}

output "auth0_issuer_base_url" {
  description = "Auth0 Issuer Base URL"
  value       = module.auth0.issuer_base_url
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GitHub
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

output "github_environment" {
  value = module.github_secrets.environment_name
}

output "github_secrets_created" {
  value = module.github_secrets.secrets_created
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# E2Eテスト用
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

output "e2e_test_email" {
  value = var.e2e_test_email
}

output "e2e_test_password" {
  value     = random_password.e2e_test_password.result
  sensitive = true
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# デプロイ情報まとめ
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

output "deployment_info" {
  description = "Deployment information summary"
  value = {
    environment = local.environment
    project     = local.project_name

    database = {
      provider = "Neon"
      host     = module.neon.host
      name     = module.neon.database_name
    }

    services = {
      web = {
        provider = "Render"
        url      = module.render.web_service_url
      }
      api = {
        provider = "Render"
        url      = module.render.api_service_url
      }
      worker = {
        provider = "Render (Background Worker)"
        id       = module.render.worker_service_id
      }
    }

    storage = {
      provider = "Backblaze B2"
      bucket   = module.backblaze.bucket_name
      endpoint = module.backblaze.s3_endpoint
    }

    auth = {
      provider       = "Auth0"
      issuer_base_url = module.auth0.issuer_base_url
    }

    github = {
      environment = module.github_secrets.environment_name
      secrets     = module.github_secrets.secrets_created
    }
  }
}
