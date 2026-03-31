#!/bin/bash
set -ex
exec > /var/log/caseyapp-setup.log 2>&1

# Install Node.js 22 LTS
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
yum install -y nodejs git nginx

# Install certbot for SSL
yum install -y certbot python3-certbot-nginx

# Create app user
useradd -m -s /bin/bash caseyapp

# Download and extract app code from S3
cd /home/caseyapp
aws s3 cp s3://boothapp-sessions-752266476357/demo-setup/caseyapp-demo.zip /tmp/caseyapp.zip
unzip -qo /tmp/caseyapp.zip -d /home/caseyapp/app
chown -R caseyapp:caseyapp /home/caseyapp/app

# Install management server deps
cd /home/caseyapp/app/management
sudo -u caseyapp npm install --production

# Create environment file
cat > /home/caseyapp/app/management/.env <<'ENVEOF'
PORT=4000
S3_BUCKET=boothapp-sessions-752266476357
AWS_REGION=us-east-1
NODE_ENV=production
ENVEOF
chown caseyapp:caseyapp /home/caseyapp/app/management/.env

# Create systemd service
cat > /etc/systemd/system/caseyapp-management.service <<'SVCEOF'
[Unit]
Description=CaseyApp Management Server
After=network.target

[Service]
Type=simple
User=caseyapp
WorkingDirectory=/home/caseyapp/app/management
EnvironmentFile=/home/caseyapp/app/management/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable caseyapp-management
systemctl start caseyapp-management

# Configure nginx reverse proxy
cat > /etc/nginx/conf.d/caseyapp.conf <<'NGXEOF'
server {
    listen 80;
    server_name caseyapp.trendcyberrange.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGXEOF

# Remove default server block if it conflicts
sed -i '/listen.*80.*default_server/d' /etc/nginx/nginx.conf 2>/dev/null || true

nginx -t && systemctl enable nginx && systemctl start nginx

# Attempt SSL cert (may fail if DNS not yet propagated)
certbot --nginx -d caseyapp.trendcyberrange.com --non-interactive --agree-tos -m admin@trendcyberrange.com || echo "SSL setup deferred - run manually after DNS propagates"

echo "Setup complete at $(date)" > /home/caseyapp/setup-complete.txt
