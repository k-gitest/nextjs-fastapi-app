# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Production環境 - ローカル変数
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

locals {
  project_name = var.project_name
  environment  = var.environment

  github_repository = regex(
    "github\\.com/([^/]+/[^/]+?)(?:\\.git)?$",
    var.github_repo_url
  )[0]

  neon_project_name     = "${local.project_name}-db-${local.environment}"
  backblaze_bucket_name = "${local.project_name}-assets-${local.environment}"
  render_app_name       = "${local.project_name}-${local.environment}"
}
