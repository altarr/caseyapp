#!/usr/bin/env bash
# setup-demo-tenants.sh — Upload mock tenant pool to S3 for demo day.
#
# Creates 5 mock V1 tenants and uploads them to the tenant-pool key
# that tenant-pool.js reads at runtime.
#
# Requires: aws CLI (profile: hackathon)
# Usage:    ./scripts/setup-demo-tenants.sh
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BUCKET="boothapp-sessions-752266476357"
REGION="us-east-1"
PROFILE="hackathon"
AWS="aws --profile ${PROFILE} --region ${REGION}"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

CREATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)

echo "============================================================"
echo "  BoothApp — Mock Tenant Pool Setup"
echo "  Bucket: s3://${BUCKET}"
echo "============================================================"
echo ""

# ── Build tenant pool JSON ───────────────────────────────────────────────────
echo "Creating mock tenant pool (5 tenants) ..."

cat > "${TMP}/tenants.json" <<EOF
{
  "tenants": [
    {
      "tenant_id": "demo-tenant-01",
      "tenant_url": "https://portal.xdr.trendmicro.com/demo/tenant-01",
      "login_email": "demo@boothapp.trendmicro.com",
      "status": "available",
      "created_at": "${CREATED_AT}",
      "cleanup_tag": "boothapp-demo"
    },
    {
      "tenant_id": "demo-tenant-02",
      "tenant_url": "https://portal.xdr.trendmicro.com/demo/tenant-02",
      "login_email": "demo@boothapp.trendmicro.com",
      "status": "available",
      "created_at": "${CREATED_AT}",
      "cleanup_tag": "boothapp-demo"
    },
    {
      "tenant_id": "demo-tenant-03",
      "tenant_url": "https://portal.xdr.trendmicro.com/demo/tenant-03",
      "login_email": "demo@boothapp.trendmicro.com",
      "status": "available",
      "created_at": "${CREATED_AT}",
      "cleanup_tag": "boothapp-demo"
    },
    {
      "tenant_id": "demo-tenant-04",
      "tenant_url": "https://portal.xdr.trendmicro.com/demo/tenant-04",
      "login_email": "demo@boothapp.trendmicro.com",
      "status": "available",
      "created_at": "${CREATED_AT}",
      "cleanup_tag": "boothapp-demo"
    },
    {
      "tenant_id": "demo-tenant-05",
      "tenant_url": "https://portal.xdr.trendmicro.com/demo/tenant-05",
      "login_email": "demo@boothapp.trendmicro.com",
      "status": "available",
      "created_at": "${CREATED_AT}",
      "cleanup_tag": "boothapp-demo"
    }
  ]
}
EOF

# ── Upload to S3 ─────────────────────────────────────────────────────────────
echo "Uploading tenant pool to s3://${BUCKET}/tenant-pool/tenants.json ..."

${AWS} s3api put-object \
  --bucket "${BUCKET}" \
  --key "tenant-pool/tenants.json" \
  --body "${TMP}/tenants.json" \
  --content-type "application/json" \
  --tagging "boothapp-cleanup=demo-2026-04-01" \
  --quiet 2>/dev/null || \
${AWS} s3api put-object \
  --bucket "${BUCKET}" \
  --key "tenant-pool/tenants.json" \
  --body "${TMP}/tenants.json" \
  --content-type "application/json" \
  --tagging "boothapp-cleanup=demo-2026-04-01"

# ── Verify ───────────────────────────────────────────────────────────────────
echo ""
echo "Verifying upload ..."
${AWS} s3 ls "s3://${BUCKET}/tenant-pool/tenants.json"

TENANT_COUNT=$(python3 -c "
import json
data = json.load(open('${TMP}/tenants.json'))
print(len(data.get('tenants', [])))
" 2>/dev/null || echo "5")

echo ""
echo "============================================================"
echo "  Mock tenant pool uploaded successfully!"
echo "  Tenants: ${TENANT_COUNT}"
echo "  S3 key:  tenant-pool/tenants.json"
echo "  Tag:     boothapp-cleanup=demo-2026-04-01"
echo "============================================================"
