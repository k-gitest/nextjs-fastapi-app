# データソース
data "auth0_client" "web" {
  client_id = auth0_client.web.id
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Auth0 モジュール - 出力値
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

output "client_id" {
  description = "Auth0 Client ID (AUTH0_CLIENT_ID)"
  value       = auth0_client.web.client_id
}

# 仕様変更により、セキュリティ上の理由から auth0_client リソースから client_secret 属性が直接エクスポートされないためデータソースから渡している
output "client_secret" {
  description = "Auth0 Client Secret (AUTH0_CLIENT_SECRET)"
  value       = data.auth0_client.web.client_secret # 
  sensitive   = true
}

output "issuer_base_url" {
  description = "Auth0 Issuer Base URL (AUTH0_ISSUER_BASE_URL)"
  # テナントドメインは provider 設定の domain から構築
  value = "https://${var.app_name}-${var.environment}.auth0.com"
}
