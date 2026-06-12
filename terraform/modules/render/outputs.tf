# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Render モジュール - 出力値
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

output "web_service_id" {
  description = "Render Next.js web service ID"
  value       = render_web_service.web.id
}

output "web_service_url" {
  description = "Next.js web service URL"
  value       = "https://${render_web_service.web.name}.onrender.com"
}

output "api_service_id" {
  description = "Render FastAPI service ID"
  value       = render_web_service.api.id
}

output "api_service_url" {
  description = "FastAPI service URL"
  value       = "https://${render_web_service.api.name}.onrender.com"
}

output "worker_service_id" {
  description = "Render background worker service ID"
  value       = render_web_service.worker.id
}

output "worker_service_name" {
  description = "Render background worker service name"
  value       = render_web_service.worker.name
}
