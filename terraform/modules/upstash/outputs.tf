# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Upstash モジュール - 出力値
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

output "redis_rest_url" {
  value     = upstash_redis_database.main.endpoint
  sensitive = true
}

output "redis_rest_token" {
  value     = upstash_redis_database.main.rest_token
  sensitive = true
}

output "vector_endpoint" {
  value     = upstash_vector_index.main.endpoint
  sensitive = true
}

output "vector_token" {
  value     = upstash_vector_index.main.token
  sensitive = true
}
/*
output "qstash_token" {
  value     = upstash_qstash_topic.main.rest_token
  sensitive = true
}
*/
/*
output "qstash_current_signing_key" {
  description = "QStash current signing key (FastAPI webhook 署名検証用)"
  value       = upstash_qstash_topic.main.qstash_token
  sensitive   = true
}
*/
/*
output "qstash_next_signing_key" {
  description = "QStash next signing key (ローテーション用)"
  value       = upstash_qstash_topic.main.custom_domain
  sensitive   = true
}
*/

output "qstash_topic_name" {
  value = upstash_qstash_topic.main.name
}
