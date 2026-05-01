variable "aws_region" {
  description = "AWS region for S3 and control-plane resources."
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

variable "asset_domain_name" {
  description = "Optional custom domain for CloudFront, for example assets.pulse.example.com."
  type        = string
  default     = ""
}

variable "cloudfront_certificate_arn" {
  description = "Optional ACM certificate ARN in us-east-1 when asset_domain_name is set."
  type        = string
  default     = ""
}

variable "allowed_cors_origins" {
  description = "Browser origins allowed to upload/read asset objects directly when signed URLs are used."
  type        = list(string)
  default     = []
}

variable "enable_cloudfront_logging" {
  description = "Whether to enable CloudFront standard logs. Requires cloudfront_log_bucket_name."
  type        = bool
  default     = false
}

variable "cloudfront_log_bucket_name" {
  description = "Existing S3 log bucket domain name for CloudFront logs, for example logs-bucket.s3.amazonaws.com."
  type        = string
  default     = ""
}
