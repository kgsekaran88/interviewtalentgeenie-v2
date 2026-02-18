# Deployment Guide

## Overview

TalentGeenie is a standard React + Vite application that can be deployed to any hosting platform that supports Node.js applications. This guide covers multiple deployment options including local development, cloud platforms, and serverless hosting.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Exporting from Lovable](#exporting-from-lovable)
3. [Local Deployment](#local-deployment)
4. [Cloud Platforms](#cloud-platforms)
   - [AWS (Amazon Web Services)](#aws-deployment)
   - [Azure (Microsoft Azure)](#azure-deployment)
   - [GCP (Google Cloud Platform)](#gcp-deployment)
5. [Serverless Platforms](#serverless-platforms)
   - [Vercel](#vercel-deployment)
   - [Netlify](#netlify-deployment)
6. [Docker Deployment](#docker-deployment)
7. [Environment Variables](#environment-variables)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- Node.js 18+ installed
- npm or bun package manager
- Git (for version control)
- Your Lovable Cloud backend credentials

---

## Exporting from Lovable

### Step 1: Connect to GitHub

1. In Lovable editor, click **GitHub** → **Connect to GitHub**
2. Authorize the Lovable GitHub App
3. Select your GitHub account/organization
4. Click **Create Repository**

Your code will sync automatically to GitHub.

### Step 2: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### Step 3: Install Dependencies

```bash
npm install
# or
bun install
```

---

## Local Deployment

### Development Server

Run the app locally for testing:

```bash
npm run dev
# Runs on http://localhost:8080
```

### Production Build

Build for production:

```bash
npm run build
# Creates optimized build in 'dist' folder
```

Preview production build:

```bash
npm run preview
# Runs production build on http://localhost:4173
```

### Run on Personal Laptop (Production Mode)

1. Build the application:
```bash
npm run build
```

2. Serve using a static file server:
```bash
npm install -g serve
serve -s dist -p 3000
```

Your app will be available at `http://localhost:3000`

---

## Cloud Platforms

## AWS Deployment

### Option 1: AWS Amplify (Easiest)

1. **Connect Repository**
   - Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
   - Click "New app" → "Host web app"
   - Connect your GitHub repository
   - Select the branch (usually `main`)

2. **Configure Build Settings**
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: dist
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```

3. **Add Environment Variables**
   - Go to App settings → Environment variables
   - Add all required variables (see [Environment Variables](#environment-variables))

4. **Deploy**
   - Save and deploy
   - AWS Amplify will automatically build and deploy on every push

### Option 2: AWS S3 + CloudFront

1. **Build the Application**
   ```bash
   npm run build
   ```

2. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://your-app-name
   aws s3 website s3://your-app-name --index-document index.html --error-document index.html
   ```

3. **Upload Build Files**
   ```bash
   aws s3 sync dist/ s3://your-app-name --delete
   ```

4. **Configure CloudFront**
   - Create CloudFront distribution
   - Set origin to S3 bucket
   - Configure custom error responses (404 → /index.html for SPA routing)

5. **Set Bucket Policy**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-app-name/*"
       }
     ]
   }
   ```

### Option 3: AWS EC2

1. **Launch EC2 Instance**
   - Choose Ubuntu Server 22.04 LTS
   - Configure security group (allow HTTP/HTTPS)

2. **SSH into Instance**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

3. **Install Dependencies**
   ```bash
   sudo apt update
   sudo apt install nodejs npm nginx -y
   ```

4. **Clone and Build**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd YOUR_REPO_NAME
   npm install
   npm run build
   ```

5. **Configure Nginx**
   ```bash
   sudo nano /etc/nginx/sites-available/default
   ```

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       root /home/ubuntu/YOUR_REPO_NAME/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

6. **Restart Nginx**
   ```bash
   sudo systemctl restart nginx
   ```

---

## Azure Deployment

### Option 1: Azure Static Web Apps (Recommended)

1. **Login to Azure**
   ```bash
   az login
   ```

2. **Create Static Web App**
   ```bash
   az staticwebapp create \
     --name your-app-name \
     --resource-group your-resource-group \
     --source https://github.com/YOUR_USERNAME/YOUR_REPO_NAME \
     --location "eastus2" \
     --branch main \
     --app-location "/" \
     --output-location "dist"
   ```

3. **Configure GitHub Action** (auto-created)
   - Azure creates a GitHub Actions workflow automatically
   - Add environment variables in Azure Portal

4. **Access Your App**
   - URL: `https://your-app-name.azurestaticapps.net`

### Option 2: Azure App Service

1. **Create App Service**
   ```bash
   az webapp create \
     --resource-group your-resource-group \
     --plan your-app-service-plan \
     --name your-app-name \
     --runtime "NODE|18-lts"
   ```

2. **Deploy from GitHub**
   ```bash
   az webapp deployment source config \
     --name your-app-name \
     --resource-group your-resource-group \
     --repo-url https://github.com/YOUR_USERNAME/YOUR_REPO_NAME \
     --branch main
   ```

3. **Configure Build**
   - Add startup command: `npm run build && npm run preview`
   - Set environment variables in Configuration settings

---

## GCP Deployment

### Option 1: Firebase Hosting (Easiest)

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Initialize Firebase**
   ```bash
   firebase init hosting
   ```
   - Select "Use an existing project" or create new
   - Set public directory to `dist`
   - Configure as single-page app: Yes
   - Don't overwrite index.html

3. **Build and Deploy**
   ```bash
   npm run build
   firebase deploy
   ```

### Option 2: Google Cloud Run

1. **Create Dockerfile** (see [Docker Deployment](#docker-deployment))

2. **Build Container**
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/talentgeenie
   ```

3. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy talentgeenie \
     --image gcr.io/YOUR_PROJECT_ID/talentgeenie \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

### Option 3: Google App Engine

1. **Create app.yaml**
   ```yaml
   runtime: nodejs18
   
   handlers:
     - url: /.*
       secure: always
       script: auto
   ```

2. **Deploy**
   ```bash
   gcloud app deploy
   ```

---

## Serverless Platforms

## Vercel Deployment

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```
   - Follow prompts to link project
   - Vercel auto-detects Vite configuration

3. **Or Use GitHub Integration**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository
   - Configure environment variables
   - Deploy

**Auto-Configuration:**
- Vercel automatically detects Vite
- Build command: `npm run build`
- Output directory: `dist`

## Netlify Deployment

1. **Create netlify.toml**
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

2. **Deploy via CLI**
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify init
   netlify deploy --prod
   ```

3. **Or Use GitHub Integration**
   - Go to [netlify.com](https://netlify.com)
   - Click "New site from Git"
   - Connect GitHub repository
   - Configure build settings
   - Deploy

---

## Docker Deployment

### Dockerfile

Create `Dockerfile` in project root:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration for SPA routing
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Build and Run

```bash
# Build image
docker build -t talentgeenie .

# Run container
docker run -p 8080:80 talentgeenie

# Access at http://localhost:8080
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

---

## Environment Variables

### Required Variables

Your app uses Lovable Cloud, which means **environment variables are auto-configured** when running on Lovable's platform. However, when self-hosting, you need to configure:

```env
# Supabase (Lovable Cloud) Configuration
VITE_SUPABASE_URL=https://vtztavcqjmirktkjdprm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=vtztavcqjmirktkjdprm
```

### Getting Your Credentials

1. **In Lovable Editor:**
   - The credentials are already configured
   - Check the `.env` file in your project

2. **For Self-Hosting:**
   - Copy values from Lovable's `.env` file
   - Add them to your hosting platform's environment variables

### Platform-Specific Setup

**AWS Amplify / Elastic Beanstalk:**
- Add in Console → Environment variables

**Azure:**
- Add in Portal → Configuration → Application settings

**GCP:**
- Add via `gcloud run services update --set-env-vars`

**Vercel/Netlify:**
- Add in Dashboard → Settings → Environment variables

**Docker:**
- Pass via `-e` flag or `docker-compose.yml`

---

## Important Notes

### Backend Connectivity

⚠️ **Critical:** This app uses **Lovable Cloud** (Supabase) for:
- Database
- Authentication
- Edge Functions
- Storage

When self-hosting the frontend:
- The app will still connect to Lovable Cloud backend
- No separate backend deployment needed
- Ensure environment variables are correctly set

### CORS Configuration

If you encounter CORS issues:
1. The Supabase backend is already configured for CORS
2. Ensure your production URL is whitelisted
3. Contact Lovable support if issues persist

### Custom Domain

To use a custom domain:
1. Configure DNS to point to your hosting platform
2. Set up SSL/TLS certificate (most platforms auto-provision)
3. Update environment variables if needed

---

## Troubleshooting

### Build Fails

**Problem:** `npm run build` fails

**Solutions:**
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (requires 18+)
- Review build logs for specific errors

### Blank Page After Deploy

**Problem:** Deployment succeeds but shows blank page

**Solutions:**
1. Check browser console for errors
2. Verify environment variables are set
3. Ensure SPA routing is configured (redirect all routes to `/index.html`)
4. Check network tab for failed API requests

### Authentication Issues

**Problem:** Users can't sign in

**Solutions:**
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- Check that backend is accessible from production URL
- Review browser console for specific auth errors

### API Connection Failures

**Problem:** App can't connect to backend

**Solutions:**
- Confirm environment variables are correct
- Test backend connectivity: `curl $VITE_SUPABASE_URL`
- Check network tab for blocked requests
- Verify CORS settings

---

## Performance Optimization

### Production Checklist

- [ ] Enable gzip/brotli compression
- [ ] Set proper cache headers
- [ ] Use CDN for static assets
- [ ] Enable HTTP/2
- [ ] Configure service worker for offline support
- [ ] Optimize images and assets
- [ ] Enable minification (Vite does this by default)

### CDN Configuration

For best performance, use a CDN:

**CloudFront (AWS):**
- Create distribution pointing to S3
- Enable compression
- Set cache policies

**Azure CDN:**
- Create CDN profile
- Add endpoint to Static Web App

**Cloud CDN (GCP):**
- Enable Cloud CDN on load balancer
- Configure cache rules

---

## Continuous Deployment

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
          
      - name: Deploy to AWS S3
        run: aws s3 sync dist/ s3://your-bucket-name --delete
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

---

## Cost Estimates

### Free Tier Options

- **Vercel:** 100GB bandwidth/month free
- **Netlify:** 100GB bandwidth/month free
- **Firebase Hosting:** 10GB storage, 360MB/day transfer
- **AWS Amplify:** 1000 build minutes/month, 15GB served/month

### Paid Options (Approximate)

- **AWS S3 + CloudFront:** ~$5-20/month (low-medium traffic)
- **Azure Static Web Apps:** $9/month (standard plan)
- **GCP Cloud Run:** Pay per request (~$5-50/month)
- **AWS EC2:** $5-50/month (depends on instance size)

---

## Support

For deployment issues:
- **Lovable Cloud Backend:** Contact Lovable support
- **Platform-Specific:** Check platform documentation
- **General Issues:** Review logs and error messages

---

**Built with Lovable Cloud** | [Back to Main Documentation](/docs)
