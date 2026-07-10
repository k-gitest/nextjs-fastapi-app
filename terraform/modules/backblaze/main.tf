# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Backblaze B2 モジュール - リソース定義
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

terraform {
  required_providers {
    b2 = {
      source  = "Backblaze/b2"
      version = "~> 0.8"
    }
  }
}

resource "b2_bucket" "assets" {
  bucket_name = var.bucket_name
  bucket_type = var.bucket_type

  cors_rules {
    cors_rule_name  = "s3Upload"
    allowed_origins = var.allowed_origins
    allowed_headers = ["*"]

    allowed_operations = [
      "s3_put",
      "s3_get",
      "s3_head"
    ]

    expose_headers = [
      "ETag"
    ]

    max_age_seconds = 3600
  }

  lifecycle_rules {
    file_name_prefix             = ""
    days_from_hiding_to_deleting = 1
  }
}

resource "b2_application_key" "main" {
  key_name = "${var.bucket_name}-key"

  capabilities = [
    "listBuckets",
    "listFiles",
    "readFiles",
    "shareFiles",
    "writeFiles",
    "deleteFiles"
  ]

  bucket_ids = [b2_bucket.assets.id]
}
