# Docker Deployment Guide

This guide covers deploying TalentGeenie using Docker across various cloud platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Docker Deployment](#local-docker-deployment)
- [AWS Deployment](#aws-deployment)
- [Google Cloud Platform](#google-cloud-platform)
- [Azure Deployment](#azure-deployment)
- [DigitalOcean](#digitalocean)
- [Kubernetes](#kubernetes)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

1. **Docker** (v20.10 or higher)
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   
   # Verify installation
   docker --version
   ```

2. **Docker Compose** (v2.0 or higher)
   ```bash
   # Verify installation
   docker-compose --version
   ```

### Required Credentials

- Supabase project credentials (URL, Anon Key, Project ID)
- Cloud provider account (for cloud deployments)

## Local Docker Deployment

### Quick Start

1. **Clone Repository**
   ```bash
   git clone https://github.com/yourusername/talentgeenie.git
   cd talentgeenie
   ```

2. **Set Environment Variables**
   ```bash
   # Create .env file
   cat > .env << EOF
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_SUPABASE_PROJECT_ID=your_project_id
   EOF
   ```

3. **Build and Run**
   ```bash
   # Using Docker Compose (recommended)
   docker-compose up -d
   
   # OR using Docker directly
   docker build -t talentgeenie .
   docker run -p 8080:80 --env-file .env talentgeenie
   ```

4. **Access Application**
   ```
   http://localhost:8080
   ```

### Docker Commands

```bash
# Build image
docker build -t talentgeenie .

# Run container
docker run -d -p 8080:80 --name talentgeenie --env-file .env talentgeenie

# View logs
docker logs -f talentgeenie

# Stop container
docker stop talentgeenie

# Remove container
docker rm talentgeenie

# Remove image
docker rmi talentgeenie
```

### Docker Compose Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and start
docker-compose up -d --build

# Scale (if needed)
docker-compose up -d --scale talentgeenie=3
```

## AWS Deployment

### Option 1: AWS ECS (Elastic Container Service)

#### Prerequisites
- AWS CLI configured
- ECR repository created

#### Steps

1. **Authenticate Docker to ECR**
   ```bash
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin \
     <account-id>.dkr.ecr.us-east-1.amazonaws.com
   ```

2. **Build and Tag Image**
   ```bash
   # Build image
   docker build -t talentgeenie \
     --build-arg VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
     --build-arg VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
     --build-arg VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
     .
   
   # Tag for ECR
   docker tag talentgeenie:latest \
     <account-id>.dkr.ecr.us-east-1.amazonaws.com/talentgeenie:latest
   ```

3. **Push to ECR**
   ```bash
   docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/talentgeenie:latest
   ```

4. **Create ECS Task Definition** (`task-definition.json`)
   ```json
   {
     "family": "talentgeenie",
     "networkMode": "awsvpc",
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "256",
     "memory": "512",
     "containerDefinitions": [
       {
         "name": "talentgeenie",
         "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/talentgeenie:latest",
         "portMappings": [
           {
             "containerPort": 80,
             "protocol": "tcp"
           }
         ],
         "environment": [
           {
             "name": "NODE_ENV",
             "value": "production"
           }
         ],
         "logConfiguration": {
           "logDriver": "awslogs",
           "options": {
             "awslogs-group": "/ecs/talentgeenie",
             "awslogs-region": "us-east-1",
             "awslogs-stream-prefix": "ecs"
           }
         }
       }
     ]
   }
   ```

5. **Deploy to ECS**
   ```bash
   # Register task definition
   aws ecs register-task-definition --cli-input-json file://task-definition.json
   
   # Create or update service
   aws ecs create-service \
     --cluster my-cluster \
     --service-name talentgeenie \
     --task-definition talentgeenie \
     --desired-count 2 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}"
   ```

### Option 2: AWS App Runner

1. **Create App Runner Service**
   ```bash
   aws apprunner create-service \
     --service-name talentgeenie \
     --source-configuration '{
       "ImageRepository": {
         "ImageIdentifier": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/talentgeenie:latest",
         "ImageRepositoryType": "ECR",
         "ImageConfiguration": {
           "Port": "80",
           "RuntimeEnvironmentVariables": {
             "NODE_ENV": "production"
           }
         }
       },
       "AutoDeploymentsEnabled": true
     }' \
     --instance-configuration '{
       "Cpu": "1 vCPU",
       "Memory": "2 GB"
     }'
   ```

2. **Access Application**
   - App Runner provides a public URL automatically
   - Configure custom domain in App Runner console

## Google Cloud Platform

### Option 1: Cloud Run

1. **Build and Push to GCR**
   ```bash
   # Configure Docker for GCR
   gcloud auth configure-docker
   
   # Build and tag
   docker build -t gcr.io/PROJECT_ID/talentgeenie \
     --build-arg VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
     --build-arg VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
     --build-arg VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
     .
   
   # Push to GCR
   docker push gcr.io/PROJECT_ID/talentgeenie
   ```

2. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy talentgeenie \
     --image gcr.io/PROJECT-ID/talentgeenie \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --port 80 \
     --memory 512Mi \
     --cpu 1
   ```

3. **Access Application**
   ```bash
   # Get service URL
   gcloud run services describe talentgeenie --region us-central1 --format 'value(status.url)'
   ```

### Option 2: GKE (Kubernetes)

See [Kubernetes section](#kubernetes) below.

## Azure Deployment

### Option 1: Azure Container Instances

1. **Create Resource Group**
   ```bash
   az group create --name talentgeenie-rg --location eastus
   ```

2. **Create Container Registry**
   ```bash
   az acr create \
     --resource-group talentgeenie-rg \
     --name talentgeenieregistry \
     --sku Basic
   ```

3. **Build and Push**
   ```bash
   # Login to ACR
   az acr login --name talentgeenieregistry
   
   # Build and push
   az acr build \
     --registry talentgeenieregistry \
     --image talentgeenie:latest \
     --build-arg VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
     --build-arg VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
     --build-arg VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
     .
   ```

4. **Deploy Container**
   ```bash
   az container create \
     --resource-group talentgeenie-rg \
     --name talentgeenie \
     --image talentgeenieregistry.azurecr.io/talentgeenie:latest \
     --dns-name-label talentgeenie-app \
     --ports 80 \
     --cpu 1 \
     --memory 1
   ```

### Option 2: Azure App Service

1. **Create App Service Plan**
   ```bash
   az appservice plan create \
     --name talentgeenie-plan \
     --resource-group talentgeenie-rg \
     --is-linux \
     --sku B1
   ```

2. **Create Web App**
   ```bash
   az webapp create \
     --resource-group talentgeenie-rg \
     --plan talentgeenie-plan \
     --name talentgeenie-app \
     --deployment-container-image-name talentgeenieregistry.azurecr.io/talentgeenie:latest
   ```

3. **Configure Container**
   ```bash
   az webapp config container set \
     --name talentgeenie-app \
     --resource-group talentgeenie-rg \
     --docker-custom-image-name talentgeenieregistry.azurecr.io/talentgeenie:latest \
     --docker-registry-server-url https://talentgeenieregistry.azurecr.io
   ```

## DigitalOcean

### Deploy to App Platform

1. **Install doctl CLI**
   ```bash
   # Install doctl
   snap install doctl
   
   # Authenticate
   doctl auth init
   ```

2. **Create App Spec** (`app.yaml`)
   ```yaml
   name: talentgeenie
   services:
   - name: web
     github:
       repo: yourusername/talentgeenie
       branch: main
       deploy_on_push: true
     dockerfile_path: Dockerfile
     source_dir: /
     http_port: 80
     envs:
     - key: VITE_SUPABASE_URL
       value: ${VITE_SUPABASE_URL}
       type: SECRET
     - key: VITE_SUPABASE_ANON_KEY
       value: ${VITE_SUPABASE_ANON_KEY}
       type: SECRET
     - key: VITE_SUPABASE_PROJECT_ID
       value: ${VITE_SUPABASE_PROJECT_ID}
       type: SECRET
     instance_size_slug: basic-xxs
     instance_count: 1
   ```

3. **Deploy**
   ```bash
   doctl apps create --spec app.yaml
   ```

## Kubernetes

### Deployment Configuration

1. **Create Kubernetes Manifests**

`deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: talentgeenie
  labels:
    app: talentgeenie
spec:
  replicas: 3
  selector:
    matchLabels:
      app: talentgeenie
  template:
    metadata:
      labels:
        app: talentgeenie
    spec:
      containers:
      - name: talentgeenie
        image: <your-registry>/talentgeenie:latest
        ports:
        - containerPort: 80
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: talentgeenie-service
spec:
  type: LoadBalancer
  selector:
    app: talentgeenie
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: talentgeenie-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - talentgeenie.example.com
    secretName: talentgeenie-tls
  rules:
  - host: talentgeenie.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: talentgeenie-service
            port:
              number: 80
```

2. **Deploy to Kubernetes**
   ```bash
   # Apply configurations
   kubectl apply -f deployment.yaml
   
   # Check status
   kubectl get pods
   kubectl get services
   
   # View logs
   kubectl logs -f deployment/talentgeenie
   ```

## Environment Variables

### Required Variables


```bash
# Frontend Environment Variables
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

### Required Secrets (Edge Functions)

These must be set in Lovable Cloud Secrets or your deployment's secret management:

| Secret | Purpose | Required |
|--------|---------|----------|
| `RESEND_API_KEY` | Auth & application emails | ✅ Yes |
| `GOOGLE_GEMINI_API_KEY` | AI evaluations | ✅ Yes |
| `STRIPE_SECRET_KEY` | Payment processing | Optional |

### Auth Email System

The platform uses database-stored email templates for authentication:

| Template Key | Purpose |
|--------------|---------|
| `auth_email_verification` | Email verification on signup |
| `auth_password_recovery` | Password reset emails |
| `auth_magic_link` | Magic link login |
| `auth_invite` | User invitations |
| `auth_email_change` | Email change confirmation |

These templates are editable via the Email Template Editor and are sent by the `auth-email-hook` edge function.

### Setting Variables per Platform

**AWS ECS:**
```json
"environment": [
  {"name": "VITE_SUPABASE_URL", "value": "..."}
]
```

**GCP Cloud Run:**
```bash
--set-env-vars VITE_SUPABASE_URL=...
```

**Azure:**
```bash
az webapp config appsettings set --settings VITE_SUPABASE_URL=...
```

**Kubernetes:**
```yaml
env:
- name: VITE_SUPABASE_URL
  valueFrom:
    secretKeyRef:
      name: supabase-secrets
      key: url
```

## Troubleshooting

### Common Issues

**Issue: Container fails to start**
```bash
# Check logs
docker logs talentgeenie

# Common causes:
# - Missing environment variables
# - Port conflicts
# - Build errors
```

**Issue: Health check fails**
```bash
# Test health endpoint
curl http://localhost:8080/health

# Should return: "healthy"
```

**Issue: Application not accessible**
```bash
# Check if container is running
docker ps

# Check port mapping
docker port talentgeenie

# Verify firewall rules (cloud)
```

**Issue: High memory usage**
```bash
# Check container stats
docker stats talentgeenie

# Solution: Increase memory limit
docker run --memory="1g" ...
```

### Debug Commands

```bash
# Enter container
docker exec -it talentgeenie sh

# Check nginx config
docker exec talentgeenie cat /etc/nginx/conf.d/default.conf

# View nginx logs
docker exec talentgeenie tail -f /var/log/nginx/error.log

# Test connectivity
docker exec talentgeenie wget -O- http://localhost/health
```

## Cost Estimates

### Cloud Platforms (Monthly)

**AWS ECS (Fargate):**
- 2 tasks x 0.5GB RAM x $0.04/GB = ~$30

**GCP Cloud Run:**
- Free tier: 2M requests
- Paid: ~$20-40 for moderate traffic

**Azure Container Instances:**
- 1 vCPU, 1GB RAM = ~$30

**DigitalOcean App Platform:**
- Basic plan: $5-12/month

**Kubernetes (GKE/EKS/AKS):**
- Cluster: ~$70/month
- Nodes: ~$30-100/month
- Total: ~$100-170/month

## Next Steps

- Set up CI/CD pipeline
- Configure monitoring and logging
- Implement auto-scaling
- Set up SSL/TLS certificates
- Configure CDN for assets

---

**Last Updated:** 2025-01-10  
**Version:** 1.0

For more help, see [Troubleshooting Guide](./src/docs/troubleshooting.md)