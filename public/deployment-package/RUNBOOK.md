# IAS Platform Deployment Runbook

## Prerequisites
- AWS CLI configured with admin credentials
- Terraform >= 1.5.0
- GitHub CLI (gh)
- Python 3.9+ (for migration scripts)

## Step-by-Step Deployment

### 1. Prepare Secrets Manager
```bash
# Create secrets in AWS Secrets Manager
aws secretsmanager create-secret --name ias-jwt-secret --secret-string "your-jwt-secret"
aws secretsmanager create-secret --name ias-smtp-password --secret-string "your-smtp-pass"
aws secretsmanager create-secret --name ias-openai-key --secret-string "your-openai-key"
```

### 2. Configure Variables
Edit `deployment-variables.yml` with your values.

### 3. Initialize Terraform
```bash
cd infra/terraform
terraform init -backend-config=backend.hcl
```

### 4. Run Dry Run
```bash
terraform plan -var-file=deployment-variables.yml
```

### 5. Apply Infrastructure
```bash
terraform apply -var-file=deployment-variables.yml
```

### 6. Run Migration (Optional)
```bash
python3 scripts/export_migration.py --source-db $SOURCE_DB --mask-pii --output export.json
python3 scripts/import_migration.py --target-db $TARGET_DB --export-file export.json
```

### 7. Verify Deployment
```bash
curl https://your-domain.com/health
```

### 8. Revoke Lovable Access
```bash
./scripts/revoke_lovable_access.sh --environment production --github-org your-org --repo ias-platform-copy
```

## Rollback Procedure
```bash
git revert HEAD
terraform apply -var-file=deployment-variables.yml
```
