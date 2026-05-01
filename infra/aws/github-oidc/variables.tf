variable "aws_region" {
  description = "AWS region for IAM API calls."
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "Expected AWS account ID. Leave empty to skip the guard."
  type        = string
  default     = ""
}

variable "project_name" {
  description = "Short project name used for resource naming."
  type        = string
  default     = "pulse"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "staging"
}

variable "github_owner" {
  description = "GitHub organization or user that owns the repository."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository name."
  type        = string
}

variable "github_subjects" {
  description = "Allowed GitHub OIDC subject claims."
  type        = list(string)
}

variable "create_oidc_provider" {
  description = "Create the GitHub OIDC provider. Set false if the account already has one."
  type        = bool
  default     = true
}
