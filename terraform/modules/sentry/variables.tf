variable "sentry_organization" {
  description = "The slug of the Sentry organization"
  type        = string
}

variable "sentry_team" {
  description = "The slug of the Sentry team to assign the projects"
  type        = string
}

variable "environment" {
  description = "The target environment (e.g., staging, production)"
  type        = string
}