# Deployment Acceptance Checklist

Use this checklist to verify successful deployment of the IAS Platform.

## Pre-Deployment

- [ ] **Secrets configured in Secrets Manager**
  - [ ] JWT_SECRET
  - [ ] DB_PASSWORD
  - [ ] SMTP_PASSWORD (if email enabled)
  - [ ] OPENAI_API_KEY (if AI features enabled)
  - [ ] STRIPE_API_KEY (if payments enabled)
  - [ ] PINECONE_API_KEY (if chatbot enabled)

- [ ] **GitHub repository created**
  - [ ] Repository exists in target organization
  - [ ] Main branch created
  - [ ] Deploy keys configured
  - [ ] GitHub Actions enabled

- [ ] **AWS credentials configured**
  - [ ] IAM role for deployment created
  - [ ] S3 bucket for Terraform state exists
  - [ ] DynamoDB table for state locking exists
  - [ ] Required AWS permissions verified

- [ ] **Configuration file validated**
  - [ ] deployment-variables.yml created
  - [ ] All required fields populated
  - [ ] Domain name DNS configured
  - [ ] SSL certificate requirements met

## Infrastructure Deployment

- [ ] **Terraform initialization successful**
  ```bash
  terraform init (exit code 0)
  ```

- [ ] **Terraform plan completed without errors**
  ```bash
  terraform plan -var-file=deployment-variables.yml (exit code 0)
  ```
  - [ ] Expected resource count matches plan output
  - [ ] No unexpected destroys
  - [ ] Cost estimate reviewed and approved

- [ ] **Terraform apply successful**
  ```bash
  terraform apply -var-file=deployment-variables.yml (exit code 0)
  ```
  - [ ] All resources created
  - [ ] No errors in output
  - [ ] Outputs populated correctly

## Infrastructure Verification

- [ ] **VPC and Networking**
  - [ ] VPC created with correct CIDR
  - [ ] Public and private subnets in multiple AZs
  - [ ] Internet Gateway attached
  - [ ] NAT Gateways operational
  - [ ] Route tables configured correctly

- [ ] **Database (RDS)**
  - [ ] RDS instance running
  - [ ] Connection from application successful
  - [ ] Backup retention configured
  - [ ] Multi-AZ enabled (if production)
  - [ ] Security groups allow only application access

- [ ] **Storage (S3)**
  - [ ] Recordings bucket created
  - [ ] Encryption at rest enabled
  - [ ] Lifecycle policies configured
  - [ ] Bucket accessible from application
  - [ ] CORS configured correctly

- [ ] **Compute (ECS)**
  - [ ] ECS cluster created
  - [ ] Service running with desired task count
  - [ ] Tasks healthy and passing health checks
  - [ ] Auto-scaling configured
  - [ ] CloudWatch logs working

- [ ] **Load Balancer**
  - [ ] ALB created and active
  - [ ] Target group registered
  - [ ] Health checks passing
  - [ ] HTTPS listener configured
  - [ ] HTTP to HTTPS redirect working

- [ ] **SSL/TLS**
  - [ ] Certificate issued and validated
  - [ ] Certificate attached to ALB
  - [ ] HTTPS working without warnings
  - [ ] Certificate auto-renewal configured

- [ ] **DNS**
  - [ ] Route53 records created
  - [ ] Domain resolves to ALB
  - [ ] www subdomain configured (if applicable)
  - [ ] DNS propagation complete

## Application Deployment

- [ ] **Container build successful**
  - [ ] Docker image built without errors
  - [ ] Image pushed to ECR
  - [ ] Image tagged correctly

- [ ] **Application deployed to ECS**
  - [ ] Service updated with new image
  - [ ] Tasks started successfully
  - [ ] Old tasks drained gracefully
  - [ ] No deployment errors

- [ ] **Environment variables configured**
  - [ ] All required env vars set
  - [ ] Secrets Manager integration working
  - [ ] Database URL correct
  - [ ] API keys accessible

## Smoke Tests (Automated)

Run: `npm run test:smoke -- --baseUrl=https://your-domain.com`

- [ ] **Health check passing**
  ```
  curl https://your-domain.com/health
  Response: {"status":"healthy"}
  ```

- [ ] **Landing page loads**
  - [ ] HTTP 200 response
  - [ ] Page renders without errors
  - [ ] Images and assets load

- [ ] **Authentication endpoints accessible**
  - [ ] /auth page loads
  - [ ] Signup form visible
  - [ ] Login form visible

- [ ] **Database connectivity**
  - [ ] API can connect to database
  - [ ] Queries execute successfully
  - [ ] Connection pooling working

- [ ] **Storage accessibility**
  - [ ] Application can access S3 bucket
  - [ ] File upload test successful
  - [ ] Signed URLs generate correctly

## Functional Tests (Manual)

- [ ] **User Registration**
  - [ ] Can create new account
  - [ ] Email verification works (if enabled)
  - [ ] Password reset works

- [ ] **User Login**
  - [ ] Can log in with valid credentials
  - [ ] Invalid credentials rejected
  - [ ] Session persists across page reloads

- [ ] **Interview Creation**
  - [ ] Recruiter can create interview
  - [ ] AI question generation works
  - [ ] Interview saves successfully

- [ ] **Interview Taking**
  - [ ] Candidate can access interview link
  - [ ] Questions display correctly
  - [ ] Answers can be submitted

- [ ] **Proctoring**
  - [ ] Camera/mic permissions requested
  - [ ] Pre-interview checks pass
  - [ ] Violations logged correctly
  - [ ] Recording upload works

- [ ] **Evaluation**
  - [ ] AI evaluation completes
  - [ ] Scores calculated correctly
  - [ ] Reports generated successfully

## Performance Tests

- [ ] **Page Load Times**
  - [ ] Landing page < 2s
  - [ ] Dashboard < 3s
  - [ ] Interview page < 3s

- [ ] **API Response Times**
  - [ ] Health endpoint < 200ms
  - [ ] Auth endpoints < 500ms
  - [ ] Data queries < 1s

- [ ] **Concurrent Users**
  - [ ] Can handle expected load
  - [ ] No errors under load
  - [ ] Auto-scaling triggers correctly

## Security Verification

- [ ] **SSL/TLS**
  - [ ] HTTPS enforced
  - [ ] TLS 1.2+ only
  - [ ] No mixed content warnings

- [ ] **Authentication**
  - [ ] JWT tokens secured
  - [ ] Session management working
  - [ ] Logout clears session

- [ ] **Authorization**
  - [ ] Role-based access control working
  - [ ] Protected routes inaccessible without auth
  - [ ] Admin features restricted

- [ ] **Database Security**
  - [ ] RLS policies active
  - [ ] Database not publicly accessible
  - [ ] Credentials stored securely

- [ ] **API Security**
  - [ ] Rate limiting configured
  - [ ] CORS configured correctly
  - [ ] Input validation working

## Migration Verification (if applicable)

- [ ] **Data Export Successful**
  ```bash
  python3 scripts/export_migration.py --dry-run (exit code 0)
  ```
  - [ ] Export manifest created
  - [ ] PII masked correctly
  - [ ] Referential integrity maintained

- [ ] **Data Import Successful**
  ```bash
  python3 scripts/import_migration.py --dry-run (exit code 0)
  ```
  - [ ] All partners imported
  - [ ] All users imported
  - [ ] All interviews imported
  - [ ] ID mappings correct
  - [ ] No import errors

- [ ] **Data Validation**
  - [ ] Record counts match
  - [ ] Random sampling shows correct data
  - [ ] Relationships preserved

## Monitoring Setup

- [ ] **Prometheus configured**
  - [ ] Metrics endpoint accessible
  - [ ] Scraping configured correctly
  - [ ] Data being collected

- [ ] **Grafana dashboard imported**
  - [ ] Dashboard accessible
  - [ ] Metrics displaying correctly
  - [ ] Real-time updates working

- [ ] **Alerting configured**
  - [ ] Alert rules loaded
  - [ ] Alert emails configured
  - [ ] Test alert sent successfully

- [ ] **CloudWatch Logs**
  - [ ] Application logs flowing
  - [ ] Retention period configured
  - [ ] Log insights queries working

## Post-Deployment

- [ ] **Lovable Access Revoked**
  ```bash
  ./scripts/revoke_lovable_access.sh (exit code 0)
  ```
  - [ ] Deploy keys removed
  - [ ] IAM role revoked
  - [ ] Webhooks disabled
  - [ ] Revocation report generated

- [ ] **Documentation Updated**
  - [ ] Runbook reflects actual deployment
  - [ ] Credentials documented securely
  - [ ] Support contacts updated
  - [ ] Architecture diagram current

- [ ] **Backup Verification**
  - [ ] Database backup completed
  - [ ] Backup restore tested
  - [ ] Backup schedule configured

- [ ] **Disaster Recovery Plan**
  - [ ] Recovery procedures documented
  - [ ] RTO/RPO defined
  - [ ] DR test scheduled

## Rollback Readiness

- [ ] **Rollback Plan Documented**
  - [ ] Previous version tagged
  - [ ] Rollback steps clear
  - [ ] Database migration reversible

- [ ] **Rollback Test**
  - [ ] Dry-run rollback successful
  - [ ] Data integrity maintained
  - [ ] Downtime window acceptable

## Sign-Off

- [ ] **Technical Lead Approval**
  - Signature: ________________
  - Date: ________________

- [ ] **Operations Lead Approval**
  - Signature: ________________
  - Date: ________________

- [ ] **Business Stakeholder Approval**
  - Signature: ________________
  - Date: ________________

## Post-Go-Live (After 24 hours)

- [ ] **No Critical Issues**
  - [ ] No P0/P1 incidents
  - [ ] Error rates within threshold
  - [ ] Performance meets SLA

- [ ] **User Feedback Collected**
  - [ ] Initial user reports positive
  - [ ] No widespread complaints
  - [ ] Support tickets reviewed

- [ ] **Final Acceptance**
  - [ ] Deployment considered successful
  - [ ] Handoff to operations complete
  - [ ] Retrospective scheduled

---

**Deployment Date**: ________________  
**Deployed By**: ________________  
**Environment**: ________________  
**Version**: ________________

**Notes**:
