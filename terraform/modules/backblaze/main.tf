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

  lifecycle_rules {
    file_name_prefix              = ""
    days_from_uploading_to_hiding = null
    days_from_hiding_to_deleting  = null
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

  bucket_id = b2_bucket.assets.id
}
