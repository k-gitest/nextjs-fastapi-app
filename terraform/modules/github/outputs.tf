# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GitHub モジュール - 出力値
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

output "environment_name" {
  description = "GitHub Environment name"
  value       = github_repository_environment.main.environment
}

output "variables_created" {
  description = "List of Environment Variables created"
  value = [
    github_actions_environment_variable.web_url.variable_name,
    github_actions_environment_variable.api_url.variable_name,
  ]
}

output "secrets_created" {
  description = "List of Environment Secrets created"
  value = [
    github_actions_environment_secret.database_url.secret_name,
    github_actions_environment_secret.pghost.secret_name,
    github_actions_environment_secret.pguser.secret_name,
    github_actions_environment_secret.pgpassword.secret_name,
    github_actions_environment_secret.pgdatabase.secret_name,
    github_actions_environment_secret.auth0_secret.secret_name,
    github_actions_environment_secret.auth0_client_id.secret_name,
    github_actions_environment_secret.auth0_client_secret.secret_name,
    github_actions_environment_secret.auth0_issuer_base_url.secret_name,
    github_actions_environment_secret.internal_api_secret.secret_name,
    github_actions_environment_secret.upstash_redis_rest_url.secret_name,
    github_actions_environment_secret.upstash_redis_rest_token.secret_name,
    github_actions_environment_secret.upstash_vector_rest_url.secret_name,
    github_actions_environment_secret.upstash_vector_rest_token.secret_name,
    github_actions_environment_secret.qstash_token.secret_name,
    github_actions_environment_secret.qstash_current_signing_key.secret_name,
    github_actions_environment_secret.qstash_next_signing_key.secret_name,
    github_actions_environment_secret.aws_access_key_id.secret_name,
    github_actions_environment_secret.aws_secret_access_key.secret_name,
    github_actions_environment_secret.gemini_api_key.secret_name,
    github_actions_environment_secret.resend_api_key.secret_name,
    github_actions_environment_secret.motherduck_token.secret_name,
    github_actions_environment_secret.e2e_test_email.secret_name,
    github_actions_environment_secret.e2e_test_password.secret_name,
  ]
}
