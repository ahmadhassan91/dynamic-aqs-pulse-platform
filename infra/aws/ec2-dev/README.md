# Pulse Dev EC2 Environment

This stack creates a simple testing environment:

- one Ubuntu EC2 instance, default `t3.small`
- Elastic IP for DNS mapping
- security group for SSH, HTTP, HTTPS
- Node.js 20, pnpm, PostgreSQL, Nginx
- systemd services for Pulse API and CRM Web
- local `/etc/pulse/pulse.env` bootstrap file

The screenshot context maps to:

- AWS account: `622221238806`
- Region: `us-east-1`

## Create Deploy Key

```bash
ssh-keygen -t ed25519 -C pulse-dev-deploy -f ~/.ssh/pulse-dev-deploy
```

Paste `~/.ssh/pulse-dev-deploy.pub` into `terraform.tfvars` as `ssh_public_key`.
Add the private key contents to GitHub Actions as `DEV_EC2_SSH_PRIVATE_KEY`.

## Apply

```bash
cd infra/aws/ec2-dev
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

Map your domain with an `A` record to the `public_ip` output.

After DNS is mapped, update `/etc/pulse/pulse.env` through the `DEV_ENV_FILE` GitHub secret so callback/base URLs use the domain instead of the raw IP.

## GitHub Secrets

Set these repository secrets for `.github/workflows/deploy-dev-ec2.yml`:

- `DEV_EC2_HOST`: Elastic IP output
- `DEV_EC2_SSH_PRIVATE_KEY`: private half of the deploy key
- `DEV_ENV_FILE`: optional full env file override for `/etc/pulse/pulse.env`

The workflow deploys automatically from the `dev` branch.

## First Login Checks

```bash
ssh ubuntu@<public_ip>
sudo systemctl status pulse-api pulse-web nginx postgresql
sudo journalctl -u pulse-api -n 100 --no-pager
sudo journalctl -u pulse-web -n 100 --no-pager
```

This is intentionally a testing setup. For production, move Postgres to RDS, terminate TLS with ACM/ALB or CloudFront, and move secrets into SSM Parameter Store or Secrets Manager.
