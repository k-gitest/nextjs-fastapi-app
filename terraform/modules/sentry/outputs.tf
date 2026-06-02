output "web_dsn" {
  description = "Sentry DSN for web (Next.js)"
  value       = data.sentry_key.web.dsn_public
  sensitive   = true
}

output "api_dsn" {
  description = "Sentry DSN for api (FastAPI)"
  value       = data.sentry_key.api.dsn_public
  sensitive   = true
}

output "worker_dsn" {
  description = "Sentry DSN for worker (Node.js)"
  value       = data.sentry_key.worker.dsn_public
  sensitive   = true
}