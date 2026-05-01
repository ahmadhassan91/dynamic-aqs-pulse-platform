output "aws_account_id" {
  description = "AWS account where resources were created."
  value       = data.aws_caller_identity.current.account_id
}

output "asset_bucket_name" {
  description = "Private S3 bucket used for Pulse digital assets."
  value       = aws_s3_bucket.assets.bucket
}

output "asset_bucket_arn" {
  description = "Private S3 bucket ARN."
  value       = aws_s3_bucket.assets.arn
}

output "asset_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for public asset delivery."
  value       = aws_cloudfront_distribution.assets.id
}

output "asset_cloudfront_domain_name" {
  description = "CloudFront distribution domain name."
  value       = aws_cloudfront_distribution.assets.domain_name
}

output "asset_public_base_url" {
  description = "Base URL to configure in PULSE_ASSET_PUBLIC_BASE_URL."
  value       = local.use_custom_domain ? "https://${var.asset_domain_name}" : "https://${aws_cloudfront_distribution.assets.domain_name}"
}

output "asset_read_write_policy_arn" {
  description = "Attach this policy to the Pulse API execution role."
  value       = aws_iam_policy.asset_read_write.arn
}

output "pulse_env" {
  description = "Environment values to copy into the Pulse runtime."
  value = {
    APP_STORAGE_PROVIDER                   = "s3"
    AWS_REGION                             = var.aws_region
    PULSE_ASSET_S3_BUCKET                  = aws_s3_bucket.assets.bucket
    PULSE_ASSET_S3_REGION                  = var.aws_region
    PULSE_ASSET_CLOUDFRONT_DISTRIBUTION_ID = aws_cloudfront_distribution.assets.id
    PULSE_ASSET_CLOUDFRONT_DOMAIN_NAME     = aws_cloudfront_distribution.assets.domain_name
    PULSE_ASSET_PUBLIC_BASE_URL            = local.use_custom_domain ? "https://${var.asset_domain_name}" : "https://${aws_cloudfront_distribution.assets.domain_name}"
  }
}
