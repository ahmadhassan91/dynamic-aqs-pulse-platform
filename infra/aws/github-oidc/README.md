# GitHub OIDC Deploy Role

This bootstrap stack creates the IAM role used by `.github/workflows/aws-assets-infra.yml`.

Run it once from an AWS principal with IAM permissions:

```bash
cd infra/aws/github-oidc
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

Then set the workflow variables:

- `AWS_ROLE_TO_ASSUME`: `github_actions_role_arn` output
- `AWS_ACCOUNT_ID`: `622221238806`
- `AWS_REGION`: `us-east-1`

If the AWS account already has a GitHub OIDC provider, set `create_oidc_provider = false` before applying.

Keep `github_subjects` narrow. Start with staging and pull requests, then add production after the production deployment environment is ready.
