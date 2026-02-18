# TalentGeenie - Complete Production Deployment Guide

**For Beginners: Step-by-Step Instructions for Mac M1 and Windows**

This guide will walk you through deploying TalentGeenie completely independently from Lovable, with your own infrastructure.

---

## Table of Contents

1. [Understanding Your Options](#understanding-your-options)
2. [Prerequisites - What You Need to Install](#prerequisites)
3. [Step 1: Get the Code from Lovable](#step-1-get-the-code-from-lovable)
4. [Step 2: Choose Your Backend Strategy](#step-2-choose-your-backend-strategy)
5. [Step 3: Deploy Frontend with Docker (Recommended)](#step-3-deploy-frontend-with-docker)
6. [Step 4: Self-Host Everything (Full Independence)](#step-4-self-host-everything)
7. [Step 5: Deploy to Cloud Providers](#step-5-deploy-to-cloud-providers)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance & Updates](#maintenance--updates)

---

## Understanding Your Options

Before starting, understand what you're deploying:

| Component | What It Is | Options |
|-----------|-----------|---------|
| **Frontend** | React app (what users see) | Deploy anywhere |
| **Backend** | Database + Authentication + Edge Functions | Keep Lovable Cloud OR self-host |

### Deployment Scenarios

| Scenario | Complexity | Monthly Cost | Best For |
|----------|------------|--------------|----------|
| **A: Lovable Cloud + Self-host Frontend** | Easy | $0-20 | Most users |
| **B: Fully Self-Hosted** | Hard | $30-100 | Enterprise/Privacy requirements |
| **C: Cloud Provider (AWS/GCP/Azure)** | Medium | $50-200 | Scalability needs |

---

## Prerequisites

### For Mac M1

Open Terminal (press `Cmd + Space`, type "Terminal", press Enter) and run these commands one by one:

#### 1. Install Homebrew (Mac Package Manager)

```bash
# Copy and paste this entire command:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# After installation, add to PATH (the installer will show you the exact command, but typically):
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc
```

#### 2. Install Git

```bash
brew install git

# Verify installation
git --version
# Should show: git version 2.x.x
```

#### 3. Install Node.js

```bash
brew install node@20

# Add to PATH
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Verify installation
node --version
# Should show: v20.x.x

npm --version
# Should show: 10.x.x
```

#### 4. Install Docker Desktop (for containerized deployment)

```bash
# Download from official site (Apple Silicon version)
# Go to: https://www.docker.com/products/docker-desktop/
# Click "Download for Mac - Apple Chip"
# Open the downloaded .dmg file
# Drag Docker to Applications folder
# Open Docker from Applications
# Wait for Docker to start (whale icon in menu bar)

# Verify installation (after Docker is running)
docker --version
# Should show: Docker version 24.x.x
```

---

### For Windows

#### 1. Install Git

1. Go to: https://git-scm.com/download/win
2. Download the 64-bit installer
3. Run the installer
4. **Important settings during installation:**
   - Select "Use Git from Windows Command Prompt"
   - Select "Checkout as-is, commit Unix-style line endings"
   - Keep other defaults
5. Open **PowerShell** (right-click Start button → "Windows PowerShell")
6. Verify: `git --version`

#### 2. Install Node.js

1. Go to: https://nodejs.org/
2. Download the **LTS version** (20.x.x)
3. Run the installer with default settings
4. Open **new PowerShell window** (important!)
5. Verify: `node --version` and `npm --version`

#### 3. Install Docker Desktop

1. Go to: https://www.docker.com/products/docker-desktop/
2. Click "Download for Windows"
3. Run the installer
4. **Enable WSL 2** when prompted (recommended)
5. Restart your computer
6. Open Docker Desktop from Start menu
7. Wait for Docker to start (icon in system tray)
8. Open PowerShell, verify: `docker --version`

---

## Step 1: Get the Code from Lovable

### 1.1 Connect Lovable to GitHub

1. Open your Lovable project
2. Click on **Settings** (gear icon in top left)
3. Go to **GitHub** tab
4. Click **"Connect to GitHub"**
5. Authorize Lovable to access your GitHub
6. Click **"Push to GitHub"**
7. Choose repository name (e.g., "talentgeenie")
8. Click **"Create Repository"**

Your code is now on GitHub!

### 1.2 Clone the Repository to Your Computer

**On Mac (Terminal):**
```bash
# Navigate to where you want the project
cd ~/Desktop

# Clone your repository (replace YOUR_USERNAME with your GitHub username)
git clone https://github.com/YOUR_USERNAME/talentgeenie.git

# Enter the project folder
cd talentgeenie

# Verify you're in the right place
ls -la
# You should see files like: package.json, src/, supabase/, etc.
```

**On Windows (PowerShell):**
```powershell
# Navigate to where you want the project
cd Desktop

# Clone your repository (replace YOUR_USERNAME with your GitHub username)
git clone https://github.com/YOUR_USERNAME/talentgeenie.git

# Enter the project folder
cd talentgeenie

# Verify you're in the right place
dir
# You should see files like: package.json, src/, supabase/, etc.
```

### 1.3 Install Dependencies

```bash
# Install all required packages (this may take 2-5 minutes)
npm install

# Verify installation succeeded
npm run build
# Should complete without errors
```

---

## Step 2: Choose Your Backend Strategy

### Option A: Keep Using Lovable Cloud (Recommended for Beginners)

**Pros:** No backend setup needed, all features work, automatic updates
**Cons:** Dependent on Lovable Cloud

Your project is already connected to Lovable Cloud. The backend credentials are:
- **Project ID:** `vtztavcqjmirktkjdprm`
- **Supabase URL:** `https://vtztavcqjmirktkjdprm.supabase.co`

You just need to deploy the frontend. Skip to [Step 3](#step-3-deploy-frontend-with-docker).

### Option B: Self-Host with External Supabase

**Pros:** Full control, can switch providers
**Cons:** Need to set up Supabase account, migrate data

1. Create a free Supabase account: https://supabase.com
2. Create a new project
3. Get your credentials from Project Settings → API
4. See [Step 4](#step-4-self-host-everything) for migration steps.

### Option C: Fully Self-Hosted PostgreSQL

**Pros:** Complete independence, no external services
**Cons:** Complex, need to manage database, no Edge Functions support

See [Step 4](#step-4-self-host-everything) for complete instructions.

---

## Step 3: Deploy Frontend with Docker

This deploys just the frontend, using Lovable Cloud as the backend.

### 3.1 Create Environment File

**On Mac:**
```bash
# In your project folder, create .env file
cat > .env << 'EOF'
VITE_SUPABASE_URL=https://vtztavcqjmirktkjdprm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enRhdmNxam1pcmt0a2pkcHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzA4NDAsImV4cCI6MjA4MjkwNjg0MH0.eT1US55pKABe514mInOj8m8SaRzKUSJIADmB5d7oN-U
VITE_SUPABASE_PROJECT_ID=vtztavcqjmirktkjdprm
EOF
```

**On Windows (PowerShell):**
```powershell
# In your project folder, create .env file
@"
VITE_SUPABASE_URL=https://vtztavcqjmirktkjdprm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enRhdmNxam1pcmt0a2pkcHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzA4NDAsImV4cCI6MjA4MjkwNjg0MH0.eT1US55pKABe514mInOj8m8SaRzKUSJIADmB5d7oN-U
VITE_SUPABASE_PROJECT_ID=vtztavcqjmirktkjdprm
"@ | Out-File -FilePath .env -Encoding UTF8
```

### 3.2 Build the Docker Image

**Make sure Docker Desktop is running first!**

```bash
# Build the Docker image (this takes 3-10 minutes the first time)
docker build -t talentgeenie:latest .

# Verify the image was created
docker images | grep talentgeenie
# Should show: talentgeenie    latest    xxxxx    ...
```

### 3.3 Run the Container

```bash
# Start the container
docker run -d \
  --name talentgeenie-app \
  -p 8080:8080 \
  --restart unless-stopped \
  talentgeenie:latest

# Verify it's running
docker ps
# Should show talentgeenie-app running on port 8080
```

### 3.4 Access Your Application

Open your browser and go to: **http://localhost:8080**

🎉 **Congratulations!** Your app is now running independently on your computer!

### 3.5 Useful Docker Commands

```bash
# Stop the application
docker stop talentgeenie-app

# Start it again
docker start talentgeenie-app

# View logs
docker logs talentgeenie-app

# View live logs
docker logs -f talentgeenie-app

# Remove container (to rebuild)
docker stop talentgeenie-app
docker rm talentgeenie-app

# Remove image (to rebuild from scratch)
docker rmi talentgeenie:latest
```

---

## Step 4: Self-Host Everything

**⚠️ Advanced:** This section is for deploying with your own PostgreSQL database, completely independent from Lovable Cloud.

### 4.1 Understanding What You're Replacing

When you leave Lovable Cloud, you need to replace:

| Lovable Cloud Feature | Self-Hosted Replacement |
|-----------------------|------------------------|
| PostgreSQL Database | Your own PostgreSQL instance |
| Edge Functions | Convert to Node.js/Express APIs |
| Authentication | Supabase Auth or custom auth |
| Storage | S3/Minio/local storage |
| AI Features | Direct OpenAI/Google AI integration |

### 4.2 Start Full Stack with Docker Compose

This starts the frontend + PostgreSQL + Redis:

```bash
# Create production environment file
cat > .env << 'EOF'
# For self-hosted PostgreSQL
DB_HOST=db
DB_PORT=5432
DB_NAME=talentgeenie
DB_USER=postgres
DB_PASSWORD=CHANGE_THIS_TO_A_STRONG_PASSWORD
REDIS_PASSWORD=CHANGE_THIS_TO_ANOTHER_STRONG_PASSWORD

# App settings
APP_PORT=8080
NODE_ENV=production
EOF
```

**Start the full stack:**

```bash
# Start PostgreSQL, Redis, and the App
docker-compose -f docker-compose.prod.yml up -d

# Check all containers are running
docker-compose -f docker-compose.prod.yml ps
# Should show: talentgeenie-app, talentgeenie-db, talentgeenie-redis
```

### 4.3 Run Database Migrations

The migrations create all the tables, functions, and security policies:

```bash
# Run the migration container
docker-compose -f docker-compose.migration.yml up migrate

# You should see output like:
# ✓ Applied: 20251008011120_...
# ✓ Applied: 20251008012305_...
# ...
# ✓ All migrations complete!
```

### 4.4 Verify Database Setup

```bash
# Connect to the database to verify tables were created
docker exec -it talentgeenie-db psql -U postgres -d talentgeenie

# Inside psql, run:
\dt
# Should list tables: profiles, interviews, questions, etc.

# Exit psql
\q
```

### 4.5 Edge Functions Limitation

**Important:** When self-hosting, Edge Functions (in `supabase/functions/`) won't work automatically. You have two options:

**Option A: Keep using Lovable Cloud for Edge Functions only**
- Set `VITE_SUPABASE_URL` to point to Lovable Cloud
- Your database can still be self-hosted with Supabase connecting to it

**Option B: Rewrite Edge Functions as Express APIs**
- Create a Node.js/Express server
- Convert each Edge Function to an API endpoint
- This requires significant development effort

---

## Step 5: Deploy to Cloud Providers

### Deploy to AWS (EC2)

#### 5.1 Create EC2 Instance

1. Go to AWS Console → EC2 → Launch Instance
2. Settings:
   - **Name:** talentgeenie-production
   - **AMI:** Ubuntu Server 22.04 LTS (64-bit ARM for cost savings)
   - **Instance type:** t4g.small (2GB RAM) or t4g.medium (4GB)
   - **Key pair:** Create new or use existing
   - **Security group:** Allow HTTP (80), HTTPS (443), SSH (22)
   - **Storage:** 20 GB gp3
3. Click "Launch Instance"

#### 5.2 Connect to Your Instance

```bash
# Download your .pem key file and set permissions
chmod 400 your-key.pem

# Connect via SSH (replace with your instance's public IP)
ssh -i your-key.pem ubuntu@YOUR_INSTANCE_IP
```

#### 5.3 Install Docker on EC2

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker ubuntu

# Log out and back in (or run: newgrp docker)
exit
```

Reconnect via SSH, then:

```bash
# Verify Docker works
docker --version

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker-compose --version
```

#### 5.4 Deploy the Application

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/talentgeenie.git
cd talentgeenie

# Create .env file (use your actual values)
nano .env
# Add your environment variables, save with Ctrl+X, Y, Enter

# Build and run
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose ps
```

#### 5.5 Set Up HTTPS with Nginx

```bash
# Install Nginx and Certbot
sudo apt install nginx certbot python3-certbot-nginx -y

# Create Nginx config
sudo nano /etc/nginx/sites-available/talentgeenie

# Add this configuration:
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/talentgeenie /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically
```

---

### Deploy to Vercel (Easiest for Frontend)

If you want the simplest deployment for just the frontend:

1. Go to https://vercel.com and sign in with GitHub
2. Click "New Project"
3. Import your `talentgeenie` repository
4. Configure:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Add Environment Variables:
   - `VITE_SUPABASE_URL` = `https://vtztavcqjmirktkjdprm.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (your key)
   - `VITE_SUPABASE_PROJECT_ID` = `vtztavcqjmirktkjdprm`
6. Click "Deploy"

Your app will be live at `your-project.vercel.app` in about 2 minutes!

---

## Troubleshooting

### Docker Issues

**"Cannot connect to Docker daemon"**
```bash
# Mac: Make sure Docker Desktop is running (whale icon in menu bar)
# Windows: Make sure Docker Desktop is running (icon in system tray)

# If still failing, restart Docker Desktop
```

**"Port 8080 already in use"**
```bash
# Find what's using port 8080
lsof -i :8080  # Mac
netstat -ano | findstr :8080  # Windows

# Stop the conflicting process, or use a different port:
docker run -p 3000:8080 talentgeenie:latest
# Then access at http://localhost:3000
```

**Build fails with "npm install" errors**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Database Issues

**"Connection refused" to PostgreSQL**
```bash
# Check if database container is running
docker-compose ps

# View database logs
docker-compose logs db

# Restart database
docker-compose restart db
```

**Migrations fail**
```bash
# Check migration logs
docker-compose -f docker-compose.migration.yml logs migrate

# Try running migrations manually
docker exec -it talentgeenie-db psql -U postgres -d talentgeenie -f /migrations/your-file.sql
```

### Application Issues

**Blank page or "Loading..." forever**
1. Open browser Developer Tools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Verify environment variables are set correctly

**Authentication not working**
- If using Lovable Cloud: Make sure VITE_SUPABASE_URL points to Lovable Cloud
- If self-hosted: Ensure you've run all migrations and configured auth properly

---

## Maintenance & Updates

### Update the Application

```bash
# Pull latest code
cd talentgeenie
git pull origin main

# Rebuild Docker image
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Backup Database

```bash
# Create backup
docker exec talentgeenie-db pg_dump -U postgres talentgeenie > backup-$(date +%Y%m%d).sql

# Restore backup
docker exec -i talentgeenie-db psql -U postgres talentgeenie < backup-20240101.sql
```

### Monitor Logs

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f app
docker-compose logs -f db
```

### Check Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df
```

---

## Cost Comparison

| Deployment Method | Monthly Cost | Pros | Cons |
|-------------------|--------------|------|------|
| **Lovable Cloud** | $0-20 | Easiest, all features | Dependent on Lovable |
| **Vercel + Lovable Cloud** | $0 | Free, fast | Still uses Lovable backend |
| **Docker on Mac/PC** | $0 | Full control, local | Not accessible externally |
| **AWS t4g.small** | ~$12 | Scalable, reliable | Requires AWS knowledge |
| **DigitalOcean Droplet** | ~$6 | Simple, affordable | Limited features |
| **Fully Self-Hosted** | $30-100 | Complete independence | Complex, no Edge Functions |

---

## Next Steps

1. ✅ Clone the repository
2. ✅ Install prerequisites
3. ✅ Choose your backend strategy
4. ✅ Deploy with Docker
5. 🔲 Set up custom domain
6. 🔲 Configure SSL/HTTPS
7. 🔲 **Set up RESEND_API_KEY** for auth emails
8. 🔲 Set up monitoring
9. 🔲 Configure backups
10. 🔲 Set up CI/CD for automatic deployments

---

## Auth Email System

The platform uses database-stored email templates for authentication emails:

| Template Key | Purpose |
|--------------|---------|
| `auth_email_verification` | Email verification on signup |
| `auth_password_recovery` | Password reset emails |
| `auth_magic_link` | Magic link login |
| `auth_invite` | User invitations |
| `auth_email_change` | Email change confirmation |

**Required Secret:** `RESEND_API_KEY` - Must be set for authentication emails to work.

**Edge Function:** `auth-email-hook` - Fetches templates from database and sends via Resend.

---

## Support & Resources

- **Lovable Docs:** https://docs.lovable.dev
- **Docker Docs:** https://docs.docker.com
- **Supabase Docs:** https://supabase.com/docs
- **AWS EC2 Docs:** https://docs.aws.amazon.com/ec2

---

**Last Updated:** December 2025
**Version:** 2.0 - Complete Beginner's Guide
