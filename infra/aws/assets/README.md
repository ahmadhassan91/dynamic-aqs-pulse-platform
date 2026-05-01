# Pulse AWS Asset Storage

This stack provisions the first AWS storage layer for Pulse digital assets and Widen replacement:

- private S3 bucket with public access blocked
- bucket owner enforced object ownership
- object versioning and server-side encryption
- lifecycle cleanup for incomplete multipart uploads and old noncurrent versions
- optional CORS for signed browser upload/read workflows
- CloudFront distribution with Origin Access Control
- IAM policy for the Pulse API execution role to read/write assets and invalidate CloudFront

The screenshot context maps to:

- AWS account: `622221238806`
- Region: `us-east-1`
- Console role observed: `AWSReservedSSO_ec2_access_3ddf7316799f3b62/AhmadHassan`

That SSO role may not have enough permission for IAM, S3 policy, or CloudFront changes. Use a platform/admin deployment role for the first apply.

## Local Apply

```bash
cd infra/aws/assets
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

After apply, copy the `pulse_env` output into the Pulse runtime environment. Attach `asset_read_write_policy_arn` to the API execution role that uploads, versions, deletes, and invalidates assets.

## Remote State

Do not use local Terraform state for shared environments. Create a dedicated Terraform state bucket and lock table, then copy `backend.tf.example` to `backend.tf` and adjust the bucket/key/table values.

## Runtime Env

```bash
APP_STORAGE_PROVIDER=s3
AWS_REGION=us-east-1
PULSE_ASSET_S3_BUCKET=<asset_bucket_name>
PULSE_ASSET_S3_REGION=us-east-1
PULSE_ASSET_CLOUDFRONT_DISTRIBUTION_ID=<asset_cloudfront_distribution_id>
PULSE_ASSET_CLOUDFRONT_DOMAIN_NAME=<asset_cloudfront_domain_name>
PULSE_ASSET_PUBLIC_BASE_URL=https://<asset_cloudfront_domain_name>
```

## CI/CD

The GitHub Actions workflow at `.github/workflows/aws-assets-infra.yml` expects these repository variables or secrets:

- `AWS_ROLE_TO_ASSUME`: IAM role ARN trusted by GitHub OIDC
- `AWS_ACCOUNT_ID`: `622221238806`
- `AWS_REGION`: `us-east-1`
- `PULSE_ASSET_ALLOWED_CORS_ORIGINS_JSON`: JSON list, for example `["https://crm.example.com"]`
- `PULSE_ASSET_DOMAIN_NAME`: optional custom asset domain
- `PULSE_ASSET_CLOUDFRONT_CERTIFICATE_ARN`: optional ACM certificate ARN in `us-east-1`

Keep `terraform.tfvars`, state files, and AWS credentials out of git.

Use `infra/aws/github-oidc` to bootstrap the GitHub deployment role before enabling CI applies.
