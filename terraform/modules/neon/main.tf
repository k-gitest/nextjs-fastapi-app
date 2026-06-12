# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Neon モジュール - リソース定義
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

terraform {
  required_providers {
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.6"
    }
  }
}

resource "neon_project" "main" {
  name      = var.project_name
  region_id = var.region_id

  compute_provisioner = "k8s-neonvm"

  default_endpoint_settings {
    autoscaling_limit_min_cu = 0.25
    autoscaling_limit_max_cu = 0.25
    # suspend_timeout_seconds  = 300
  }

  pg_version                = 17
  history_retention_seconds = 21600 # 無料枠限度
}

/*
resource "neon_branch" "main" {
  project_id = neon_project.main.id
  name       = var.branch_name
}
*/
/*
resource "neon_endpoint" "main" {
  project_id = neon_project.main.id
  branch_id  = neon_project.main.default_branch_id 

  compute_provisioner      = "k8s-pod"
  type                     = "read_write"
  autoscaling_limit_min_cu = 0.25
  autoscaling_limit_max_cu = 0.25
  suspend_timeout_seconds  = 300
}
*/
resource "neon_role" "main" {
  project_id = neon_project.main.id
  branch_id  = neon_project.main.default_branch_id
  name       = "app_user"
}

resource "neon_database" "main" {
  project_id = neon_project.main.id
  branch_id  = neon_project.main.default_branch_id 
  name       = "appdb"
  owner_name = neon_role.main.name
}
