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

# 3. Deploy on server — preserve .env and DB
ssh -i "$KEY" -o StrictHostKeyChecking=no "$HOST" "sudo bash -c '
# Backup state
cp /home/caseyapp/app/management/.env /tmp/mgmt-env-backup 2>/dev/null || true
cp /home/caseyapp/app/management/data/caseyapp.db /tmp/mgmt-db-backup 2>/dev/null || true

systemctl stop caseyapp-management

# Update code
aws s3 cp s3://$BUCKET/demo-setup/caseyapp-demo.zip /tmp/caseyapp.zip --quiet
rm -rf /home/caseyapp/app
unzip -qo /tmp/caseyapp.zip -d /home/caseyapp/app

# Restore state
cp /tmp/mgmt-env-backup /home/caseyapp/app/management/.env 2>/dev/null || true
mkdir -p /home/caseyapp/app/management/data
cp /tmp/mgmt-db-backup /home/caseyapp/app/management/data/caseyapp.db 2>/dev/null || true

chown -R caseyapp:caseyapp /home/caseyapp/app
cd /home/caseyapp/app/management && su -s /bin/bash caseyapp -c \"npm install --production\" 2>&1 | tail -1

systemctl start caseyapp-management
sleep 2
curl -s http://localhost:4000/api/health
'"
echo "[3/4] Server updated"
echo "[4/4] Done"
