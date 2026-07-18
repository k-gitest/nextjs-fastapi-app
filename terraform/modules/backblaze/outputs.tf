# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Backblaze B2 モジュール - 出力値
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

output "bucket_name" {
  description = "B2 bucket name"
  value       = b2_bucket.assets.bucket_name
}

output "bucket_id" {
  description = "B2 bucket ID"
  value       = b2_bucket.assets.id
}

output "s3_endpoint" {
  description = "S3-compatible endpoint URL"
  value       = "https://s3.${var.region}.backblazeb2.com"
}

output "application_key_id" {
  description = "B2 Application Key ID"
  value       = b2_application_key.main.application_key_id
  sensitive   = true
}

output "application_key" {
  description = "B2 Application Key (secret)"
  value       = b2_application_key.main.application_key
  sensitive   = true
}

output "b2_region" {
  description = "B2 REGION"
  value       = var.region
}