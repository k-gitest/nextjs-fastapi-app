# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Backblaze B2 モジュール - 変数定義
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "bucket_name" {
  description = "B2 bucket name (e.g., nextjs-fastapi-app-assets-staging)"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.bucket_name))
    error_message = "Bucket name must be lowercase alphanumeric with hyphens."
  }
}

variable "bucket_type" {
  description = "Bucket type (allPublic or allPrivate)"
  type        = string
  default     = "allPrivate"

  validation {
    condition     = contains(["allPublic", "allPrivate"], var.bucket_type)
    error_message = "Bucket type must be 'allPublic' or 'allPrivate'."
  }
}

variable "allowed_origins" {
  type = list(string)
}

variable "region" {
  description = "Backblaze B2 region"
  type        = string
}