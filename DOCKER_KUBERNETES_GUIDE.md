# =============================================================================
# TalentGeenie Docker & Kubernetes Deployment Guide
# Complete guide for containerized production deployment
# =============================================================================

## Table of Contents
1. [Quick Start](#quick-start)
2. [Docker Deployment](#docker-deployment)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [Database Migrations](#database-migrations)
5. [Production Checklist](#production-checklist)

---

## Quick Start

### Option 1: Docker Compose (Simplest)

```bash
# Clone repository
git clone <your-repo> && cd talentgeenie

# Set environment variables
cp .env.example .env
# Edit .env with your Supabase/Lovable Cloud credentials

# Start everything
docker-compose -f docker-compose.prod.yml up -d

# Run migrations (if using self-hosted DB)
docker-compose -f docker-compose.migration.yml up migrate
```

### Option 2: Kubernetes with Helm

```bash
# Install with Lovable Cloud backend
helm install talentgeenie ./helm/talentgeenie \
  --set postgresql.enabled=false \
  --set supabase.url="YOUR_SUPABASE_URL" \
  --set supabase.anonKey="YOUR_ANON_KEY"

# Or with self-hosted database
helm install talentgeenie ./helm/talentgeenie \
  --set postgresql.enabled=true \
  --set postgresql.auth.password="secure-password"
```

---

## Docker Deployment

### Files Overview

| File | Purpose |
|------|---------|
| `Dockerfile` | Production app image |
| `Dockerfile.migration` | Migration runner image |
| `docker-compose.yml` | Basic deployment |
| `docker-compose.prod.yml` | Production with PostgreSQL + Redis |
| `docker-compose.migration.yml` | Run migrations only |

### Build & Deploy

```bash
# Build production image
docker build -t talentgeenie:latest .

# Build migration image
docker build -f Dockerfile.migration -t talentgeenie-migrate:latest .

# Run with Lovable Cloud (recommended)
docker run -d \
  -e VITE_SUPABASE_URL=https://vtztavcqjmirktkjdprm.supabase.co \
  -e VITE_SUPABASE_PUBLISHABLE_KEY=your-key \
  -p 8080:8080 \
  talentgeenie:latest

# Run with self-hosted database
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase/Lovable Cloud URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Public anon key |
| `VITE_SUPABASE_PROJECT_ID` | Yes | Project ID |
| `DB_HOST` | Self-hosted | Database host |
| `DB_PORT` | Self-hosted | Database port (default: 5432) |
| `DB_NAME` | Self-hosted | Database name |
| `DB_USER` | Self-hosted | Database user |
| `DB_PASSWORD` | Self-hosted | Database password |

---

## Kubernetes Deployment

### Helm Chart

The Helm chart in `helm/talentgeenie/` provides:

- ✅ Deployment with rolling updates
- ✅ Horizontal Pod Autoscaler (HPA)
- ✅ Ingress with TLS
- ✅ Pod Disruption Budget
- ✅ Network Policies
- ✅ Service Account
- ✅ Pre-deploy migrations
- ✅ Optional PostgreSQL & Redis

### Installation

```bash
# Update dependencies
cd helm/talentgeenie
helm dependency update

# Install (Lovable Cloud backend)
helm install talentgeenie . \
  --namespace talentgeenie \
  --create-namespace \
  --set postgresql.enabled=false \
  --set redis.enabled=false \
  --set supabase.url="https://your-project.supabase.co" \
  --set supabase.anonKey="your-anon-key" \
  --set ingress.hosts[0].host="talentgeenie.yourdomain.com"

# Install (self-hosted database)
helm install talentgeenie . \
  --namespace talentgeenie \
  --create-namespace \
  --set postgresql.enabled=true \
  --set postgresql.auth.password="secure-password" \
  --set redis.enabled=true \
  --set redis.auth.password="redis-password"
```

### Custom Values File

Create `my-values.yaml`:

```yaml
replicaCount: 5

image:
  repository: your-registry.com/talentgeenie
  tag: "v1.2.3"

ingress:
  enabled: true
  hosts:
    - host: talentgeenie.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: talentgeenie-tls
      hosts:
        - talentgeenie.example.com

resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "1"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20

# Use Lovable Cloud
postgresql:
  enabled: false
redis:
  enabled: false

supabase:
  url: "https://vtztavcqjmirktkjdprm.supabase.co"
  anonKey: "your-anon-key"
  projectId: "vtztavcqjmirktkjdprm"
```

Then install:

```bash
helm install talentgeenie ./helm/talentgeenie -f my-values.yaml
```

### Upgrading

```bash
helm upgrade talentgeenie ./helm/talentgeenie -f my-values.yaml
```

### Monitoring

```bash
# Check pods
kubectl get pods -l app.kubernetes.io/name=talentgeenie

# View logs
kubectl logs -l app.kubernetes.io/name=talentgeenie -f

# Check HPA
kubectl get hpa talentgeenie

# Check ingress
kubectl get ingress talentgeenie
```

---

## Database Migrations

### With Lovable Cloud (Recommended)

Migrations are already applied in Lovable Cloud. No action needed!

### With Self-Hosted Database

#### Option 1: Migration Script

```bash
# Run migration script
./scripts/run-migrations.sh \
  --host db.example.com \
  --port 5432 \
  --database talentgeenie \
  --user admin \
  --password secret

# Or with DATABASE_URL
DATABASE_URL=postgres://admin:secret@db.example.com:5432/talentgeenie \
  ./scripts/run-migrations.sh
```

#### Option 2: Docker Migration Container

```bash
# Build migration image
docker build -f Dockerfile.migration -t talentgeenie-migrate .

# Run against remote database
docker run --rm \
  -e DB_HOST=db.example.com \
  -e DB_PORT=5432 \
  -e DB_NAME=talentgeenie \
  -e DB_USER=admin \
  -e DB_PASSWORD=secret \
  talentgeenie-migrate
```

#### Option 3: Docker Compose Migration

```bash
# Start database and run migrations
docker-compose -f docker-compose.migration.yml up

# Or just run migrations against existing DB
docker-compose -f docker-compose.migration.yml run migrate
```

#### Option 4: Kubernetes Job

```bash
# Migrations run automatically as Helm hook
# To run manually:
kubectl create job --from=job/talentgeenie-migration manual-migration
```

### Migration Files

All migrations are in `supabase/migrations/`:

| File | Description |
|------|-------------|
| `20251227000000_baseline.sql` | Complete schema baseline |
| `20251227010001_production_functions.sql` | Database functions |
| `20251227010002_production_rls_policies.sql` | Row Level Security |
| `20251227010003_production_triggers.sql` | Triggers |
| `20251227010004_production_indexes.sql` | Performance indexes |
| `20251227010005_production_storage.sql` | Storage buckets |
| Auth email templates | 5 auth templates in `email_templates` table |

### Auth Email System

The platform uses database-stored email templates for authentication emails:

| Template | Purpose |
|----------|---------|
| `auth_email_verification` | Email verification on signup |
| `auth_password_recovery` | Password reset emails |
| `auth_magic_link` | Magic link login |
| `auth_invite` | User invitations |
| `auth_email_change` | Email change confirmation |

**Required Secret:** `RESEND_API_KEY` - Must be set in Lovable Cloud Secrets for auth emails to work.

**Edge Function:** `auth-email-hook` - Fetches templates from database and sends via Resend.

---

## Production Checklist

### Pre-Deployment

- [ ] Set strong `DB_PASSWORD` and `REDIS_PASSWORD`
- [ ] Configure TLS certificates
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure backup strategy
- [ ] Review resource limits

### Security

- [ ] Network policies enabled
- [ ] Pod security contexts configured
- [ ] Secrets stored in Kubernetes secrets or vault
- [ ] HTTPS enforced via ingress
- [ ] Image from trusted registry

### High Availability

- [ ] Multiple replicas (min 3)
- [ ] HPA configured
- [ ] Pod Disruption Budget set
- [ ] Anti-affinity rules applied
- [ ] Database replication (if self-hosted)

### Monitoring

- [ ] Health checks configured
- [ ] Prometheus metrics exposed
- [ ] Grafana dashboards set up
- [ ] Alerting rules defined
- [ ] Log aggregation configured

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs talentgeenie-app
kubectl logs -l app.kubernetes.io/name=talentgeenie

# Check health
curl http://localhost:8080/
```

### Database connection issues

```bash
# Test connection
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1"

# Check network policies
kubectl describe networkpolicy talentgeenie
```

### Migrations fail

```bash
# Check migration logs
docker-compose -f docker-compose.migration.yml logs migrate

# Run with dry-run first
./scripts/run-migrations.sh --dry-run
```

---

## Support

For issues with:
- **Docker/Kubernetes deployment**: Check this guide
- **Lovable Cloud**: Visit Lovable documentation
- **Application issues**: Check application logs