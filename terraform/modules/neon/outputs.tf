# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Neon モジュール - 出力値
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

output "project_id" {
  description = "Neon project ID"
  value       = neon_project.main.id
}

output "project_name" {
  description = "Neon project name"
  value       = neon_project.main.name
}

output "branch_id" {
  description = "Neon branch ID"
  value       = neon_branch.main.id
}

output "database_name" {
  description = "Database name"
  value       = neon_database.main.name
}

output "role_name" {
  description = "Database role name"
  value       = neon_role.main.name
}

output "host" {
  description = "Database host (endpoint)"
  value       = neon_endpoint.main.host
}

output "password" {
  description = "Neon role password"
  value       = neon_role.main.password
  sensitive   = true
}

output "connection_uri" {
  description = "PostgreSQL connection URI (for Prisma DATABASE_URL)"
  # Prisma用にsslmode=require付きで構築
  value     = "postgresql://${neon_role.main.name}:${neon_role.main.password}@${neon_endpoint.main.host}/${neon_database.main.name}?sslmode=require"
  sensitive = true
}
