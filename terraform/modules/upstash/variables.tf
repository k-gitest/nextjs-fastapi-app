# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Upstash モジュール - 変数定義
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

variable "environment" {
  description = "Environment name (staging or production)"
  type        = string
}

variable "region" {
  description = "Upstash region"
  type        = string
  default     = "us-east-1"
}
