output "github_actions_role_arn" {
  description = "Set this as the AWS_ROLE_TO_ASSUME repository variable."
  value       = aws_iam_role.github_actions_deploy.arn
}

output "github_oidc_provider_arn" {
  description = "GitHub OIDC provider ARN used by the deployment role."
  value       = local.oidc_provider_arn
}
