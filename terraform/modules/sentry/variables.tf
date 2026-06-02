variable "environment" {
  description = "Environment name (staging or production)"
  type        = string
}

variable "sentry_organization" {
  description = "Sentry organization slug"
  type        = string
}

variable "sentry_team" {
  description = "Sentry team slug"
  type        = string
}

variable "slack_workspace_name" {
  description = "Slack workspace name registered in Sentry"
  type        = string
}

variable "slack_channel" {
  description = "Slack channel for alert notifications"
  type        = string
}