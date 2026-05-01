data "aws_caller_identity" "current" {}

locals {
  normalized_project = lower(replace(var.project_name, "_", "-"))
  normalized_env     = lower(replace(var.environment, "_", "-"))
  name_prefix        = "${local.normalized_project}-${local.normalized_env}"
  bucket_name        = "${local.name_prefix}-assets-${data.aws_caller_identity.current.account_id}"
  use_custom_domain  = var.asset_domain_name != "" && var.cloudfront_certificate_arn != ""

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Module      = "pulse-digital-assets"
  }
}

resource "terraform_data" "account_guard" {
  count = var.aws_account_id == "" ? 0 : 1

  input = data.aws_caller_identity.current.account_id

  lifecycle {
    precondition {
      condition     = data.aws_caller_identity.current.account_id == var.aws_account_id
      error_message = "AWS caller account does not match var.aws_account_id."
    }
  }
}

resource "aws_s3_bucket" "assets" {
  bucket = local.bucket_name
}

resource "aws_s3_bucket_ownership_controls" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "assets" {
  count  = length(var.allowed_cors_origins) == 0 ? 0 : 1
  bucket = aws_s3_bucket.assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "PUT", "POST"]
    allowed_origins = var.allowed_cors_origins
    expose_headers  = ["ETag", "x-amz-version-id"]
    max_age_seconds = 3000
  }
}

resource "aws_cloudfront_origin_access_control" "assets" {
  name                              = "${local.name_prefix}-asset-oac"
  description                       = "Restricts Pulse asset bucket access to CloudFront."
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "assets" {
  enabled     = true
  comment     = "${var.project_name} ${var.environment} digital assets"
  price_class = "PriceClass_100"
  aliases     = local.use_custom_domain ? [var.asset_domain_name] : []

  origin {
    domain_name              = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.assets.id
    origin_id                = "s3-assets"
  }

  default_cache_behavior {
    target_origin_id       = "s3-assets"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    compress               = true

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  dynamic "logging_config" {
    for_each = var.enable_cloudfront_logging && var.cloudfront_log_bucket_name != "" ? [1] : []

    content {
      bucket          = var.cloudfront_log_bucket_name
      include_cookies = false
      prefix          = "cloudfront/${local.name_prefix}/assets/"
    }
  }

  viewer_certificate {
    acm_certificate_arn            = local.use_custom_domain ? var.cloudfront_certificate_arn : null
    cloudfront_default_certificate = local.use_custom_domain ? false : true
    minimum_protocol_version       = local.use_custom_domain ? "TLSv1.2_2021" : null
    ssl_support_method             = local.use_custom_domain ? "sni-only" : null
  }
}

data "aws_iam_policy_document" "assets_bucket" {
  statement {
    sid     = "AllowCloudFrontRead"
    effect  = "Allow"
    actions = ["s3:GetObject"]

    resources = ["${aws_s3_bucket.assets.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.assets.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id
  policy = data.aws_iam_policy_document.assets_bucket.json
}

data "aws_iam_policy_document" "asset_read_write" {
  statement {
    sid = "ListAssetBucket"
    actions = [
      "s3:GetBucketLocation",
      "s3:ListBucket",
    ]
    resources = [aws_s3_bucket.assets.arn]
  }

  statement {
    sid = "ReadWriteAssetObjects"
    actions = [
      "s3:AbortMultipartUpload",
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:PutObject",
      "s3:PutObjectTagging",
    ]
    resources = ["${aws_s3_bucket.assets.arn}/*"]
  }

  statement {
    sid       = "InvalidateAssetDistribution"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.assets.arn]
  }
}

resource "aws_iam_policy" "asset_read_write" {
  name        = "${local.name_prefix}-asset-read-write"
  description = "Allows Pulse API workers to manage digital asset objects and invalidate CloudFront."
  policy      = data.aws_iam_policy_document.asset_read_write.json
}
