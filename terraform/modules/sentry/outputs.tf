# --- DSN Outputs (For Render Environment Variables) ---
output "web_dsn" {
  description = "The public DSN for the Next.js frontend project"
  value       = data.sentry_key.web.dsn.public
  sensitive   = true
}

output "api_dsn" {
  description = "The public DSN for the FastAPI backend project"
  value       = data.sentry_key.api.dsn.public
  sensitive   = true
}

output "worker_dsn" {
  description = "The public DSN for the Node.js worker project"
  value       = data.sentry_key.worker.dsn.public
  sensitive   = true
}

# --- Project Slug Outputs (For Sentry CLI / Source Map Upload) ---
output "web_project_slug" {
  description = "The slug of the frontend project"
  value       = sentry_project.web.slug
}

output "api_project_slug" {
  description = "The slug of the backend API project"
  value       = sentry_project.api.slug
}

output "worker_project_slug" {
  description = "The slug of the worker project"
  value       = sentry_project.worker.slug
}