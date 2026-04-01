#!/usr/bin/env bash
# Deploy management server to caseyapp.trendcyberrange.com
# Preserves: .env, caseyapp.db (user accounts, events, profiles)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY="$HOME/.ssh/caseyapp-demo-key.pem"
HOST="ec2-user@34.239.159.231"
BUCKET="boothapp-sessions-752266476357"
REGION="us-east-1"
AWS="/c/Program Files/Amazon/AWSCLIV2/aws.exe"

echo "=== Deploying management server ==="

# 1. Build zip
cd "$REPO_ROOT"
git archive --format=zip --output=/tmp/caseyapp-deploy.zip HEAD
echo "[1/4] Code archived"

# 2. Upload
"$AWS" --region $REGION s3 cp /tmp/caseyapp-deploy.zip s3://$BUCKET/demo-setup/caseyapp-demo.zip --quiet
echo "[2/4] Uploaded to S3"

# 3. Deploy on server — data lives in /home/caseyapp/data (NEVER deleted)
ssh -i "$KEY" -o StrictHostKeyChecking=no "$HOST" "sudo bash -c '
# Ensure persistent data dir exists OUTSIDE the app tree
mkdir -p /home/caseyapp/data/sessions /home/caseyapp/data/badge-samples /home/caseyapp/data/uploads /home/caseyapp/data/audio-uploads
chown -R caseyapp:caseyapp /home/caseyapp/data

# Save env
cp /home/caseyapp/app/management/.env /tmp/mgmt-env-backup 2>/dev/null || true

# Migrate DB if still in old location
if [ -f /home/caseyapp/app/management/data/caseyapp.db ]; then
  cp /home/caseyapp/app/management/data/caseyapp.db /home/caseyapp/data/caseyapp.db 2>/dev/null
  cp /home/caseyapp/app/management/data/caseyapp.db-wal /home/caseyapp/data/caseyapp.db-wal 2>/dev/null
  cp /home/caseyapp/app/management/data/caseyapp.db-shm /home/caseyapp/data/caseyapp.db-shm 2>/dev/null
fi

systemctl stop caseyapp-management

# Update code only
aws s3 cp s3://$BUCKET/demo-setup/caseyapp-demo.zip /tmp/caseyapp.zip --quiet
rm -rf /home/caseyapp/app
unzip -qo /tmp/caseyapp.zip -d /home/caseyapp/app

# Restore env
cp /tmp/mgmt-env-backup /home/caseyapp/app/management/.env 2>/dev/null || true

# Symlink data dir so the app finds it at management/data
rm -rf /home/caseyapp/app/management/data
ln -s /home/caseyapp/data /home/caseyapp/app/management/data

chown -R caseyapp:caseyapp /home/caseyapp/app
cd /home/caseyapp/app/management && su -s /bin/bash caseyapp -c \"npm install --production\" 2>&1 | tail -1

systemctl start caseyapp-management
sleep 2
curl -s http://localhost:4000/api/health
'"
echo "[3/4] Server updated"
echo "[4/4] Done"
