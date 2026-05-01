output "instance_id" {
  description = "EC2 instance ID."
  value       = aws_instance.dev.id
}

output "public_ip" {
  description = "Elastic IP to map your dev domain A record to."
  value       = aws_eip.dev.public_ip
}

output "public_url" {
  description = "HTTP URL for the dev environment."
  value       = "http://${local.domain_name_or_ip}"
}

output "ssh_command" {
  description = "SSH command for server access."
  value       = "ssh ubuntu@${aws_eip.dev.public_ip}"
}

output "github_secrets_required" {
  description = "GitHub secrets needed by .github/workflows/deploy-dev-ec2.yml."
  value = [
    "DEV_EC2_HOST=${aws_eip.dev.public_ip}",
    "DEV_EC2_SSH_PRIVATE_KEY=<private key matching ssh_public_key>",
    "DEV_ENV_FILE=<optional full /etc/pulse/pulse.env override>",
  ]
}

output "instance_role_name" {
  description = "EC2 IAM role name."
  value       = aws_iam_role.dev.name
}
