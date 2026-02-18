# IAS Platform - Cost Estimate

## Overview
This document provides monthly cost estimates for deploying the IAS Platform on AWS infrastructure across three deployment sizes.

## Cost Breakdown by Size

### Small Deployment (Development/Testing)
**Target**: 10-50 concurrent users, 100 interviews/month

| Service | Configuration | Monthly Cost (USD) |
|---------|--------------|-------------------|
| **Compute (ECS)** | 2x t3.small (2 vCPU, 2GB RAM) | $30 |
| **Database (RDS)** | db.t3.micro (1 vCPU, 1GB RAM, 20GB storage) | $15 |
| **Storage (S3)** | 50GB recordings, 10GB other | $1.50 |
| **Load Balancer** | Application Load Balancer | $16 |
| **Data Transfer** | 100GB/month outbound | $9 |
| **CloudWatch** | Basic monitoring, 10GB logs | $5 |
| **Secrets Manager** | 5 secrets | $2 |
| **Route53** | 1 hosted zone, 1M queries | $1 |
| **Certificate Manager** | SSL certificates | Free |
| **NAT Gateway** | 1 NAT Gateway (minimal usage) | $32 |
| **VPC** | Standard VPC resources | $5 |
| **AI Usage (Lovable AI)** | ~1,000 API calls | $15 |
| | **TOTAL** | **~$131.50/month** |

**Recordings Storage Growth**: +$1/month per additional 50GB

---

### Medium Deployment (Production - Standard)
**Target**: 100-500 concurrent users, 1,000 interviews/month

| Service | Configuration | Monthly Cost (USD) |
|---------|--------------|-------------------|
| **Compute (ECS)** | 4x t3.medium (2 vCPU, 4GB RAM) | $120 |
| **Database (RDS)** | db.t3.medium (2 vCPU, 4GB RAM, 100GB storage) | $85 |
| **Storage (S3)** | 500GB recordings, 50GB other | $13 |
| **Load Balancer** | Application Load Balancer | $16 |
| **Data Transfer** | 500GB/month outbound | $45 |
| **CloudWatch** | Enhanced monitoring, 50GB logs | $25 |
| **Secrets Manager** | 10 secrets | $4 |
| **Route53** | 1 hosted zone, 10M queries | $1.50 |
| **Certificate Manager** | SSL certificates | Free |
| **NAT Gateway** | 2 NAT Gateways (HA setup) | $90 |
| **VPC** | Standard VPC resources | $10 |
| **Backup** | RDS automated backups (100GB) | $10 |
| **AI Usage (Lovable AI)** | ~10,000 API calls | $150 |
| **CloudFront (Optional)** | CDN for static assets | $20 |
| | **TOTAL** | **~$589.50/month** |

**Recordings Storage Growth**: +$1.15/month per additional 50GB

---

### Large Deployment (Enterprise)
**Target**: 1,000+ concurrent users, 10,000+ interviews/month

| Service | Configuration | Monthly Cost (USD) |
|---------|--------------|-------------------|
| **Compute (ECS)** | 10x t3.large (2 vCPU, 8GB RAM) | $600 |
| **Database (RDS)** | db.r5.xlarge (4 vCPU, 32GB RAM, 500GB storage) Multi-AZ | $580 |
| **Read Replica** | db.r5.large (2 vCPU, 16GB RAM) | $290 |
| **Storage (S3)** | 5TB recordings, 500GB other | $125 |
| **Load Balancer** | Application Load Balancer (high traffic) | $50 |
| **Data Transfer** | 5TB/month outbound | $450 |
| **CloudWatch** | Advanced monitoring, 200GB logs | $100 |
| **Secrets Manager** | 20 secrets | $8 |
| **Route53** | 2 hosted zones, 100M queries | $10 |
| **Certificate Manager** | SSL certificates | Free |
| **NAT Gateway** | 3 NAT Gateways (HA multi-AZ) | $135 |
| **VPC** | Standard VPC resources | $20 |
| **Backup** | RDS automated backups (1TB), S3 versioning | $115 |
| **ElastiCache (Redis)** | cache.r5.large (2 nodes) | $260 |
| **AI Usage (Lovable AI)** | ~100,000 API calls | $1,500 |
| **CloudFront** | CDN for global distribution | $150 |
| **WAF** | Web Application Firewall | $25 |
| | **TOTAL** | **~$4,418/month** |

**Recordings Storage Growth**: +$23/month per additional 1TB

---

## Additional Cost Considerations

### AI/ML Costs
- **Question Generation**: $0.015 per interview (GPT-5-mini)
- **Answer Evaluation**: $0.008 per response
- **Bias Detection**: $0.003 per scan
- **Resume Parsing**: $0.002 per resume

**Estimated AI costs included in base pricing assume**:
- Small: 100 interviews, 20 questions each = ~2,000 AI calls
- Medium: 1,000 interviews, 25 questions each = ~25,000 AI calls  
- Large: 10,000 interviews, 30 questions each = ~300,000 AI calls

### Storage Retention Strategies

#### 90-Day Retention (Default)
- Automatically deletes recordings after 90 days
- Reduces long-term storage costs
- Suitable for compliance requirements

#### 180-Day Retention
- **Small**: Add $1.50/month
- **Medium**: Add $13/month
- **Large**: Add $125/month

#### 1-Year Retention
- **Small**: Add $6/month
- **Medium**: Add $52/month
- **Large**: Add $500/month

#### Archive to Glacier
For recordings older than 90 days:
- **Storage**: $0.004/GB/month (75% cheaper)
- **Retrieval**: $0.01/GB + 3-5 hours delay
- Recommended for compliance/audit requirements

### Regional Pricing Variations
Prices above are for **ap-south-1 (Mumbai)**. Other regions may vary:
- **us-east-1 (N. Virginia)**: -5% to -10%
- **eu-west-1 (Ireland)**: +5% to +10%
- **ap-southeast-1 (Singapore)**: Similar to ap-south-1

### Cost Optimization Tips

1. **Use Spot Instances for Non-Critical Workloads**: Save up to 70% on compute
2. **Enable S3 Intelligent Tiering**: Automatically move infrequently accessed data to cheaper tiers
3. **Use CloudFront**: Reduce data transfer costs by caching at edge locations
4. **Right-Size Resources**: Monitor usage and scale down over-provisioned resources
5. **Reserved Instances**: Commit to 1-year for 30-40% savings on predictable workloads
6. **Sample Recordings**: Copy only 10% of recordings during migration to save costs

### Hidden Costs to Watch

- **Data Transfer Between AZs**: $0.01/GB (can add up with multi-AZ deployments)
- **Cross-Region Replication**: If implementing disaster recovery
- **Support Plans**: AWS Business Support adds 10% of spend (minimum $100/month)
- **Third-Party Integrations**: ATS connectors, payment gateways may have separate fees

### ROI Calculation

For a medium deployment handling 1,000 interviews/month:
- **Platform Cost**: $590/month
- **Cost per Interview**: $0.59
- **Cost per Candidate Evaluation**: ~$0.59
- **Estimated HR Time Saved**: 2 hours/interview @ $50/hour = $100/interview
- **Monthly ROI**: ($100 - $0.59) × 1,000 = $99,410 value created

### Scaling Thresholds

**When to scale up from Small to Medium:**
- Sustained 50+ concurrent users
- 500+ interviews/month
- Database CPU > 70% for extended periods
- Storage approaching 200GB

**When to scale up from Medium to Large:**
- Sustained 300+ concurrent users
- 5,000+ interviews/month
- Need for high availability (multi-AZ)
- Advanced features (caching, CDN, WAF)

---

## Summary

| Size | Monthly Cost | Per Interview | Best For |
|------|-------------|---------------|----------|
| **Small** | $131.50 | $1.32 | Dev/Test, Pilot Programs |
| **Medium** | $589.50 | $0.59 | Production, Growing Teams |
| **Large** | $4,418 | $0.44 | Enterprise, High Volume |

**Note**: All prices are estimates based on AWS pricing as of January 2025 and may vary based on actual usage patterns, region, and promotional credits. Always use AWS Cost Calculator for precise estimates.
