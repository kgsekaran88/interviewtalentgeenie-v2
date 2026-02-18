#!/bin/bash
# Revoke Previous Platform Access Script
# Automatically removes previous platform temporary access after successful deployment

set -e

ENVIRONMENT=""
GITHUB_ORG=""
REPO=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --environment) ENVIRONMENT="$2"; shift 2;;
    --github-org) GITHUB_ORG="$2"; shift 2;;
    --repo) REPO="$2"; shift 2;;
    *) echo "Unknown option: $1"; exit 1;;
  esac
done

echo "🔒 Revoking previous platform access..."
echo "Environment: $ENVIRONMENT"
echo "Repository: $GITHUB_ORG/$REPO"

# Remove deploy keys
echo "Removing deploy keys..."
gh api repos/$GITHUB_ORG/$REPO/keys --jq '.[] | select(.title | contains("deploy")) | .id' | \
  xargs -I {} gh api -X DELETE repos/$GITHUB_ORG/$REPO/keys/{}

# Revoke temporary IAM role (AWS)
echo "Revoking temporary IAM role..."
aws iam delete-role-policy --role-name platform-deploy-temp --policy-name deploy-policy || true
aws iam delete-role --role-name platform-deploy-temp || true

# Remove webhooks
echo "Removing webhooks..."
gh api repos/$GITHUB_ORG/$REPO/hooks --jq '.[] | select(.config.url | contains("deploy")) | .id' | \
  xargs -I {} gh api -X DELETE repos/$GITHUB_ORG/$REPO/hooks/{}

echo "✅ Previous platform access revoked successfully"
echo "📝 Revocation completed at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
