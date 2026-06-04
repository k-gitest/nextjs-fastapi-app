# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Upstash モジュール - リソース定義
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

terraform {
  required_providers {
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.5.0"
    }
  }
}

# --- Redis Database ---
resource "upstash_redis_database" "main" {
  database_name = "nextjs-fastapi-redis-${var.environment}"
  region        = var.region
  # plan          = "free"
  tls           = true
  eviction      = true
}

# --- Vector Index (AI検索用) ---
# gemini-embedding-001 はデフォルト3072次元だが
# Upstash 無料枠の上限が1536次元のため output_dimensionality=1536 を指定して合わせる
resource "upstash_vector_index" "main" {
  name                = "nextjs-fastapi-vector-${var.environment}"
  region              = "us-east-1"
  # dimension           = 1536 # 無料枠上限 (gemini-embedding-001 の output_dimensionality=1536 に対応)
  dimension_count = 1536
  type            = "COSINE"
  similarity_function = "cosine"
}

# --- QStash Topic ---
resource "upstash_qstash_topic" "main" {
  name = "nextjs-fastapi-tasks-${var.environment}"
}
