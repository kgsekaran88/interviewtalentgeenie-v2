#!/usr/bin/env bash
# =============================================================================
# TalentGeenie — First-Time Server Setup
# =============================================================================
# Run this ONCE on a fresh Ubuntu 22.04/24.04 VPS.
# Usage: ssh root@your-vps 'bash -s' < deploy/setup-server.sh
# =============================================================================
set -euo pipefail

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  TalentGeenie — Server Bootstrap                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# ── 1. System updates ───────────────────────────────────────────────────────
echo "→ Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Install Docker ───────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "→ Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "→ Docker already installed: $(docker --version)"
fi

# ── 3. Install Docker Compose plugin ────────────────────────────────────────
if ! docker compose version &>/dev/null; then
  echo "→ Installing Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
else
  echo "→ Docker Compose already installed: $(docker compose version)"
fi

# ── 4. Create app user ──────────────────────────────────────────────────────
if ! id "talentgeenie" &>/dev/null; then
  echo "→ Creating 'talentgeenie' user..."
  useradd -m -s /bin/bash -G docker talentgeenie
  echo "→ User 'talentgeenie' created and added to docker group"
else
  echo "→ User 'talentgeenie' already exists"
fi

APP_DIR="/home/talentgeenie/app"
BACKUP_DIR="/home/talentgeenie/backups"

mkdir -p "$APP_DIR" "$BACKUP_DIR"
chown -R talentgeenie:talentgeenie /home/talentgeenie

# ── 5. Firewall ─────────────────────────────────────────────────────────────
echo "→ Configuring firewall..."
apt-get install -y -qq ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh           # 22
ufw allow 80/tcp        # HTTP (Caddy redirect)
ufw allow 443/tcp       # HTTPS
ufw allow 443/udp       # HTTP/3 (QUIC)
ufw --force enable
echo "→ Firewall: SSH + HTTP/HTTPS only"

# ── 6. Fail2Ban ─────────────────────────────────────────────────────────────
echo "→ Installing fail2ban..."
apt-get install -y -qq fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# ── 7. Unattended upgrades ──────────────────────────────────────────────────
echo "→ Enabling unattended security upgrades..."
apt-get install -y -qq unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

# ── 8. Swap (for 4GB–8GB servers) ───────────────────────────────────────────
if [ ! -f /swapfile ]; then
  echo "→ Creating 2GB swap..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Optimize swap usage
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
else
  echo "→ Swap already configured"
fi

# ── 9. Scheduled backup cron ────────────────────────────────────────────────
echo "→ Setting up daily database backup cron..."
CRON_LINE="0 3 * * * cd $APP_DIR && bash scripts/pg-backup.sh >> /var/log/talentgeenie-backup.log 2>&1"
(crontab -u talentgeenie -l 2>/dev/null | grep -v pg-backup; echo "$CRON_LINE") | crontab -u talentgeenie -

# ── 10. Log rotation ────────────────────────────────────────────────────────
cat > /etc/logrotate.d/talentgeenie <<EOF
/var/log/talentgeenie-backup.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
}
EOF

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅ Server ready!                                          ║"
echo "║                                                            ║"
echo "║  Next steps:                                               ║"
echo "║  1. Clone the repo:                                        ║"
echo "║     su - talentgeenie                                      ║"
echo "║     git clone <repo-url> ~/app                             ║"
echo "║                                                            ║"
echo "║  2. Copy .env.production to ~/app/.env.production          ║"
echo "║     (edit DOMAIN, secrets, Sentry DSN)                     ║"
echo "║                                                            ║"
echo "║  3. Deploy:                                                ║"
echo "║     cd ~/app && bash deploy/deploy.sh                      ║"
echo "║                                                            ║"
echo "║  4. Set DNS: A record for your domain → this server's IP   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
