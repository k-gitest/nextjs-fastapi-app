# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Neon モジュール - 変数定義
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "project_name" {
  description = "Neon project name (e.g., nextjs-fastapi-app-db-staging)"
  type        = string
}

variable "branch_name" {
  description = "Database branch name"
  type        = string
  default     = "main"
}

variable "region_id" {
  description = "AWS region ID for Neon (e.g., aws-ap-southeast-1)"
  type        = string

  validation {
    condition     = can(regex("^aws-", var.region_id))
    error_message = "Region ID must be in AWS format (e.g., aws-ap-southeast-1)."
  }
}
