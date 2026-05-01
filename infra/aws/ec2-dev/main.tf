data "aws_caller_identity" "current" {}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

locals {
  normalized_project  = lower(replace(var.project_name, "_", "-"))
  normalized_env      = lower(replace(var.environment, "_", "-"))
  name_prefix         = "${local.normalized_project}-${local.normalized_env}"
  domain_name_or_ip   = var.domain_name != "" ? var.domain_name : aws_eip.dev.public_ip
  enable_asset_access = var.asset_s3_bucket_arn != ""

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Module      = "pulse-ec2-dev"
  }
}

data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "dev" {
  name               = "${local.name_prefix}-ec2-role"
  description        = "Pulse dev EC2 runtime role."
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
}

resource "aws_iam_instance_profile" "dev" {
  name = "${local.name_prefix}-ec2-profile"
  role = aws_iam_role.dev.name
}

data "aws_iam_policy_document" "asset_access" {
  count = local.enable_asset_access ? 1 : 0

  statement {
    sid = "ListAssetBucket"
    actions = [
      "s3:GetBucketLocation",
      "s3:ListBucket",
    ]
    resources = [var.asset_s3_bucket_arn]
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
    resources = ["${var.asset_s3_bucket_arn}/*"]
  }

  dynamic "statement" {
    for_each = var.asset_cloudfront_distribution_arn == "" ? [] : [var.asset_cloudfront_distribution_arn]

    content {
      sid       = "InvalidateAssetCloudFront"
      actions   = ["cloudfront:CreateInvalidation"]
      resources = [statement.value]
    }
  }
}

resource "aws_iam_role_policy" "asset_access" {
  count = local.enable_asset_access ? 1 : 0

  name   = "${local.name_prefix}-asset-access"
  role   = aws_iam_role.dev.id
  policy = data.aws_iam_policy_document.asset_access[0].json
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

resource "aws_key_pair" "deploy" {
  key_name   = "${local.name_prefix}-deploy"
  public_key = var.ssh_public_key
}

resource "aws_security_group" "dev" {
  name        = "${local.name_prefix}-sg"
  description = "Pulse dev EC2 access"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_ssh_cidrs
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "ingress" {
    for_each = var.enable_http_api_ports ? [3000, 4000] : []

    content {
      description = "Direct app port ${ingress.value}"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "dev" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  subnet_id                   = data.aws_subnets.default.ids[0]
  vpc_security_group_ids      = [aws_security_group.dev.id]
  key_name                    = aws_key_pair.deploy.key_name
  iam_instance_profile        = aws_iam_instance_profile.dev.name
  associate_public_ip_address = true
  user_data_replace_on_change = false

  user_data = templatefile("${path.module}/user-data.sh.tftpl", {
    aws_region        = var.aws_region
    domain_name_or_ip = local.domain_name_or_ip
  })

  root_block_device {
    volume_size = var.root_volume_size_gb
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name = "${local.name_prefix}-app"
  }

  lifecycle {
    ignore_changes = [ami]
  }
}

resource "aws_eip" "dev" {
  domain = "vpc"

  tags = {
    Name = "${local.name_prefix}-eip"
  }
}

resource "aws_eip_association" "dev" {
  instance_id   = aws_instance.dev.id
  allocation_id = aws_eip.dev.id
}
