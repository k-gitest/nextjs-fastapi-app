# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Staging環境 - ローカル変数
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

locals {
  project_name = var.project_name
  environment  = var.environment

  # githubの仕様で先頭にオーナー名が付与される
  # nextjs-fastapi-app だけ取れる
  github_repository = regex(
    "github\\.com/[^/]+/([^/]+?)(?:\\.git)?$",
    var.github_repo_url
  )[0]

  # リソース命名規則: {project_name}-{component}-{environment}
  neon_project_name     = "${local.project_name}-db-${local.environment}"
  backblaze_bucket_name = "${local.project_name}-assets-${local.environment}"
  # Renderのapp_nameはサービス名のプレフィックス
  # 実際のサービス名は {render_app_name}-web / -api / -worker になる
  render_app_name = "${local.project_name}-${local.environment}"
}
