data "aws_caller_identity" "current" {}

data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com"
}

locals {
  normalized_project = lower(replace(var.project_name, "_", "-"))
  normalized_env     = lower(replace(var.environment, "_", "-"))
  name_prefix        = "${local.normalized_project}-${local.normalized_env}"
  oidc_provider_arn  = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Module      = "github-oidc"
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

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github_actions.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "github_actions_trust" {
  statement {
    sid     = "AllowGitHubActionsAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = var.github_subjects
    }
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name               = "${local.name_prefix}-github-actions-deploy"
  description        = "GitHub Actions deployment role for Pulse AWS infrastructure."
  assume_role_policy = data.aws_iam_policy_document.github_actions_trust.json
}

data "aws_iam_policy_document" "asset_infra_deploy" {
  statement {
    sid = "ReadAccountIdentity"
    actions = [
      "sts:GetCallerIdentity",
    ]
    resources = ["*"]
  }

  statement {
    sid = "ManagePulseAssetBuckets"
    actions = [
      "s3:CreateBucket",
      "s3:DeleteBucket",
      "s3:GetAccelerateConfiguration",
      "s3:GetBucketAcl",
      "s3:GetBucketCORS",
      "s3:GetBucketLocation",
      "s3:GetBucketLogging",
      "s3:GetBucketOwnershipControls",
      "s3:GetBucketPolicy",
      "s3:GetBucketPublicAccessBlock",
      "s3:GetBucketTagging",
      "s3:GetBucketVersioning",
      "s3:GetEncryptionConfiguration",
      "s3:GetLifecycleConfiguration",
      "s3:ListBucket",
      "s3:ListBucketVersions",
      "s3:PutBucketCORS",
      "s3:PutBucketOwnershipControls",
      "s3:PutBucketPolicy",
      "s3:PutBucketPublicAccessBlock",
      "s3:PutBucketTagging",
      "s3:PutBucketVersioning",
      "s3:PutEncryptionConfiguration",
      "s3:PutLifecycleConfiguration",
    ]
    resources = [
      "arn:aws:s3:::${local.name_prefix}-assets-${data.aws_caller_identity.current.account_id}",
      "arn:aws:s3:::${local.name_prefix}-assets-${data.aws_caller_identity.current.account_id}/*",
    ]
  }

  statement {
    sid = "ManagePulseAssetCloudFront"
    actions = [
      "cloudfront:CreateCloudFrontOriginAccessIdentity",
      "cloudfront:CreateDistribution",
      "cloudfront:CreateInvalidation",
      "cloudfront:CreateOriginAccessControl",
      "cloudfront:DeleteDistribution",
      "cloudfront:DeleteOriginAccessControl",
      "cloudfront:GetDistribution",
      "cloudfront:GetDistributionConfig",
      "cloudfront:GetOriginAccessControl",
      "cloudfront:GetOriginAccessControlConfig",
      "cloudfront:ListDistributions",
      "cloudfront:ListTagsForResource",
      "cloudfront:TagResource",
      "cloudfront:UntagResource",
      "cloudfront:UpdateDistribution",
      "cloudfront:UpdateOriginAccessControl",
    ]
    resources = ["*"]
  }

  statement {
    sid = "ManagePulseAssetIamPolicy"
    actions = [
      "iam:CreatePolicy",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicy",
      "iam:DeletePolicyVersion",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:ListPolicyVersions",
      "iam:TagPolicy",
    ]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/${local.name_prefix}-asset-read-write",
    ]
  }
}

resource "aws_iam_policy" "asset_infra_deploy" {
  name        = "${local.name_prefix}-asset-infra-deploy"
  description = "Allows GitHub Actions to deploy Pulse asset S3 and CloudFront infrastructure."
  policy      = data.aws_iam_policy_document.asset_infra_deploy.json
}

resource "aws_iam_role_policy_attachment" "asset_infra_deploy" {
  role       = aws_iam_role.github_actions_deploy.name
  policy_arn = aws_iam_policy.asset_infra_deploy.arn
}
