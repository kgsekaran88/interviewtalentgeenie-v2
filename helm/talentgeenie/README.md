# =============================================================================
# TalentGeenie Helm Chart
# =============================================================================

This Helm chart deploys the TalentGeenie platform on Kubernetes.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- PV provisioner support (for PostgreSQL and Redis persistence)

## Installation

### Quick Start

```bash
# Add dependencies
helm dependency update ./helm/talentgeenie

# Install with default values
helm install talentgeenie ./helm/talentgeenie

# Install with custom values
helm install talentgeenie ./helm/talentgeenie -f my-values.yaml
```

### With Lovable Cloud Backend

If using Lovable Cloud for the backend (recommended):

```bash
helm install talentgeenie ./helm/talentgeenie \
  --set postgresql.enabled=false \
  --set redis.enabled=false \
  --set supabase.url="https://vtztavcqjmirktkjdprm.supabase.co" \
  --set supabase.anonKey="your-anon-key" \
  --set supabase.projectId="vtztavcqjmirktkjdprm"
```

### With Self-Hosted Database

```bash
helm install talentgeenie ./helm/talentgeenie \
  --set postgresql.enabled=true \
  --set postgresql.auth.password="secure-password" \
  --set migration.enabled=true
```

## Configuration

See `values.yaml` for all available configuration options.

### Key Configuration Options

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `3` |
| `image.repository` | Image repository | `your-registry/talentgeenie` |
| `image.tag` | Image tag | `latest` |
| `postgresql.enabled` | Deploy PostgreSQL | `true` |
| `redis.enabled` | Deploy Redis | `true` |
| `migration.enabled` | Run migrations | `true` |
| `ingress.enabled` | Enable ingress | `true` |
| `autoscaling.enabled` | Enable HPA | `true` |

## Migrations

Migrations run automatically as a Helm pre-install/pre-upgrade hook.

To run migrations manually:

```bash
kubectl create job --from=job/talentgeenie-migration manual-migration
```

## Upgrading

```bash
helm upgrade talentgeenie ./helm/talentgeenie -f my-values.yaml
```

## Uninstalling

```bash
helm uninstall talentgeenie
```

**Note:** This will not delete PVCs. To fully clean up:

```bash
kubectl delete pvc -l app.kubernetes.io/instance=talentgeenie
```