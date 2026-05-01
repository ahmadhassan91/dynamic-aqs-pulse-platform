variable "aws_region" {
  description = "AWS region for the dev EC2 environment."
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
  description = "Environment name."
  type        = string
  default     = "dev"
}

variable "instance_type" {
  description = "EC2 instance type for the testing environment."
  type        = string
  default     = "t3.small"
}

variable "root_volume_size_gb" {
  description = "Root EBS volume size."
  type        = number
  default     = 40
}

variable "ssh_public_key" {
  description = "Public SSH key allowed to connect as ubuntu and used by the GitHub deploy workflow."
  type        = string
  sensitive   = true
}

variable "allowed_ssh_cidrs" {
  description = "CIDR ranges allowed to SSH to the instance."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "domain_name" {
  description = "Optional hostname that will be mapped to the Elastic IP outside Terraform."
  type        = string
  default     = ""
}

variable "enable_http_api_ports" {
  description = "Expose raw API/Web ports directly. Keep false when Nginx is used."
  type        = bool
  default     = false
}

variable "asset_s3_bucket_arn" {
  description = "Optional Pulse asset S3 bucket ARN. When set, the EC2 role can manage asset objects."
  type        = string
  default     = ""
}

variable "asset_cloudfront_distribution_arn" {
  description = "Optional Pulse asset CloudFront distribution ARN. When set, the EC2 role can create invalidations."
  type        = string
  default     = ""
}
