# IAS Platform Deployment Package

## 📦 Package Contents

This deployment package contains everything needed to deploy a self-hosted copy of the Interview-as-a-Service (IAS) Platform to your own cloud infrastructure.

```
deployment-package/
├── infra/                          # Infrastructure as Code
│   └── terraform/
│       ├── main.tf                 # Main Terraform configuration
│       ├── variables.tf            # Variable definitions
│       └── modules/                # Terraform modules (VPC, RDS, ECS, etc.)
├── .github/                        # CI/CD Pipelines
│   └── workflows/
│       ├── plan-deploy.yml         # Terraform plan workflow
│       ├── apply-deploy.yml        # Deployment workflow
│       └── migration.yml           # Migration workflow
├── scripts/                        # Migration & Automation
│   ├── export_migration.py         # Data export script
│   ├── import_migration.py         # Data import script
│   └── revoke_lovable_access.sh    # Access revocation script
├── test-suite/                     # Automated Tests
│   ├── smoke-tests.spec.ts         # Post-deployment smoke tests
│   ├── package.json                # Test dependencies
│   └── playwright.config.ts        # Test configuration
├── monitoring/                     # Monitoring & Alerts
│   ├── prometheus-config.yml       # Prometheus configuration
│   ├── alerts.yml                  # Alert rules
│   └── grafana-dashboard.json      # Grafana dashboard
├── deployment-variables.yml        # Configuration template
├── RUNBOOK.md                      # Step-by-step deployment guide
├── COST_ESTIMATE.md                # Cost projections
├── ACCEPTANCE_CHECKLIST.md         # Acceptance criteria
└── README.md                       # This file
```

## 🚀 Quick Start

### Prerequisites

- **AWS CLI** configured with admin credentials
- **Terraform** >= 1.5.0
- **GitHub CLI** (gh) for repository management
- **Python 3.9+** for migration scripts
- **Node.js 18+** for smoke tests

### 1. Configure Deployment

```bash
# Copy the template
cp deployment-variables.yml my-deployment.yml

# Edit with your values
vim my-deployment.yml
```

### 2. Set Up Secrets

```bash
# Create secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name ias-jwt-secret \
  --secret-string "your-secure-jwt-secret"

aws secretsmanager create-secret \
  --name ias-smtp-password \
  --secret-string "your-smtp-password"

# For AI features
aws secretsmanager create-secret \
  --name ias-openai-key \
  --secret-string "your-openai-api-key"
```

### 3. Initialize Infrastructure

```bash
cd infra/terraform

# Initialize Terraform
terraform init \
  -backend-config="bucket=your-tf-state-bucket" \
  -backend-config="key=ias-platform/terraform.tfstate" \
  -backend-config="region=ap-south-1"
```

### 4. Review & Deploy

```bash
# Dry run (see what will be created)
terraform plan -var-file=../../my-deployment.yml

# Deploy infrastructure
terraform apply -var-file=../../my-deployment.yml
```

### 5. Run Smoke Tests

```bash
cd test-suite
npm install
npm run test:smoke -- --baseUrl=https://your-domain.com
```

### 6. Revoke Lovable Access

```bash
./scripts/revoke_lovable_access.sh \
  --environment production \
  --github-org your-org \
  --repo ias-platform-copy
```

## 📋 Detailed Documentation

- **[RUNBOOK.md](RUNBOOK.md)** - Complete step-by-step deployment instructions
- **[COST_ESTIMATE.md](COST_ESTIMATE.md)** - Detailed cost projections for three deployment sizes
- **[ACCEPTANCE_CHECKLIST.md](ACCEPTANCE_CHECKLIST.md)** - Comprehensive acceptance testing checklist

## 🏗️ Architecture Overview

The deployed infrastructure includes:

- **VPC** with public/private subnets across multiple AZs
- **ECS Cluster** for containerized application deployment
- **RDS PostgreSQL** database with automated backups
- **S3 Buckets** for recording storage with lifecycle policies
- **Application Load Balancer** with SSL termination
- **Route53** DNS with automatic certificate provisioning
- **CloudWatch** monitoring and log aggregation
- **Secrets Manager** for secure credential storage

## 💰 Cost Estimates

| Deployment Size | Monthly Cost | Best For |
|----------------|-------------|----------|
| **Small** | ~$132 | Dev/Test environments |
| **Medium** | ~$590 | Production (1K interviews/month) |
| **Large** | ~$4,418 | Enterprise (10K+ interviews/month) |

See [COST_ESTIMATE.md](COST_ESTIMATE.md) for detailed breakdowns.

## 🔐 Security Features

- **TLS 1.2+** encryption for all traffic
- **Row-Level Security (RLS)** on database tables
- **IAM roles** with least-privilege access
- **Secrets Manager** for credential storage
- **VPC isolation** with private subnets
- **Automated security patching**
- **WAF** (optional, for enterprise deployments)

## 🔄 Migration Guide

### Export Data from Source

```bash
python3 scripts/export_migration.py \
  --source-db "postgresql://..." \
  --partners all \
  --mask-pii \
  --output export_data.json
```

### Import Data to Target

```bash
python3 scripts/import_migration.py \
  --target-db "postgresql://..." \
  --export-file export_data.json
```

**Important**: Migration is non-destructive. Source data remains intact.

## 📊 Monitoring

### Prometheus Metrics

Access metrics at: `https://your-domain.com/metrics`

Key metrics:
- Request rate and latency
- Error rates (4xx, 5xx)
- Database connections
- Storage usage
- Proctoring violations

### Grafana Dashboard

Import the dashboard: `monitoring/grafana-dashboard.json`

### Alerts

Configured alerts for:
- High error rate (>5%)
- Application down (>2min)
- High response time (>2s)
- Database connection errors
- Memory/CPU pressure
- Disk space low
- SSL certificate expiring

## 🛠️ Troubleshooting

### Deployment Fails

```bash
# Check Terraform state
terraform show

# View detailed logs
terraform apply -var-file=my-deployment.yml -debug

# Verify AWS permissions
aws sts get-caller-identity
```

### Application Not Starting

```bash
# Check ECS task logs
aws ecs describe-tasks --cluster ias-platform-cluster --tasks <task-id>

# View CloudWatch logs
aws logs tail /ecs/ias-platform --follow
```

### Database Connection Issues

```bash
# Test database connectivity
psql "postgresql://user:pass@host:5432/dbname"

# Verify security groups
aws ec2 describe-security-groups --group-ids sg-xxxxx
```

### SSL Certificate Issues

```bash
# Check certificate status
aws acm describe-certificate --certificate-arn arn:aws:acm:...

# Verify DNS records
dig your-domain.com
nslookup your-domain.com
```

## 🔄 Rollback Procedure

If deployment issues occur:

```bash
# Revert to previous version
git revert HEAD
git push

# Rollback infrastructure
terraform apply -var-file=my-deployment.yml

# Or restore from backup
./scripts/restore_backup.sh --backup-id <backup-timestamp>
```

## 📞 Support

For deployment support:
1. Check [RUNBOOK.md](RUNBOOK.md) for detailed instructions
2. Review [ACCEPTANCE_CHECKLIST.md](ACCEPTANCE_CHECKLIST.md)
3. Examine CloudWatch logs for errors
4. Contact your infrastructure team

## 📄 License

This deployment package is proprietary and licensed for use only by authorized customers of the IAS Platform.

## 🔄 Updates

To update to a newer version:

```bash
# Pull latest code
git pull origin main

# Update infrastructure
terraform plan -var-file=my-deployment.yml
terraform apply -var-file=my-deployment.yml

# Deploy new application version
./scripts/deploy_update.sh
```

---

**Version**: 2.1.0  
**Last Updated**: December 2025  
**Maintained By**: IAS Platform Team
