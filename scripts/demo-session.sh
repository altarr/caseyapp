#!/usr/bin/env bash
# Simulate a complete demo session for testing the watcher/analysis pipeline.
# Uploads metadata, clicks, transcript, and end marker to S3.
set -euo pipefail

BUCKET="s3://boothapp-sessions-752266476357"
AWS="aws --profile hackathon --region us-east-2"
ID="DEMO-$(date +%s)"
PREFIX="${BUCKET}/sessions/${ID}"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "=== Creating demo session: ${ID} ==="

# --- 1. metadata.json ---
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cat > "${TMP}/metadata.json" <<ENDJSON
{
  "session_id": "${ID}",
  "visitor_name": "Demo Visitor",
  "company": "Test Corp",
  "badge_photo": null,
  "started_at": "${NOW}",
  "ended_at": null,
  "demo_pc": "booth-pc-demo",
  "se_name": "Demo SE",
  "audio_consent": false,
  "status": "active",
  "upload_complete": false
}
ENDJSON

echo "[1/5] Uploading metadata.json ..."
${AWS} s3 cp "${TMP}/metadata.json" "${PREFIX}/metadata.json" --quiet

# --- 2. clicks/clicks.json (5 fake clicks, 10s apart) ---
BASE_TS=$(date +%s)
cat > "${TMP}/clicks.json" <<ENDJSON
[
  {"index":1,"xpath":"//div[@class='dashboard']","url":"https://portal.v1.trendmicro.com/dashboard","ts":"$(date -u -d @$((BASE_TS))       +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r $((BASE_TS))       +%Y-%m-%dT%H:%M:%SZ)"},
  {"index":2,"xpath":"//span[@class='risk-score']","url":"https://portal.v1.trendmicro.com/risk","ts":"$(date -u -d @$((BASE_TS+10))    +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r $((BASE_TS+10))    +%Y-%m-%dT%H:%M:%SZ)"},
  {"index":3,"xpath":"//tr[@data-row='endpoint-1']","url":"https://portal.v1.trendmicro.com/endpoints","ts":"$(date -u -d @$((BASE_TS+20))    +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r $((BASE_TS+20))    +%Y-%m-%dT%H:%M:%SZ)"},
  {"index":4,"xpath":"//button[@id='isolate-btn']","url":"https://portal.v1.trendmicro.com/endpoints","ts":"$(date -u -d @$((BASE_TS+30))    +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r $((BASE_TS+30))    +%Y-%m-%dT%H:%M:%SZ)"},
  {"index":5,"xpath":"//div[@class='detection-detail']","url":"https://portal.v1.trendmicro.com/xdr","ts":"$(date -u -d @$((BASE_TS+40))    +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r $((BASE_TS+40))    +%Y-%m-%dT%H:%M:%SZ)"}
]
ENDJSON

echo "[2/5] Uploading clicks/clicks.json ..."
${AWS} s3 cp "${TMP}/clicks.json" "${PREFIX}/clicks/clicks.json" --quiet

# --- 3. transcript/transcript.json (5 dialogue entries) ---
cat > "${TMP}/transcript.json" <<ENDJSON
[
  {"speaker":"SE","text":"Welcome! Let me walk you through Vision One's unified dashboard.","ts":"${NOW}"},
  {"speaker":"Visitor","text":"How does the risk scoring work?","ts":"$(date -u -d @$((BASE_TS+12)) +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r $((BASE_TS+12)) +%Y-%m-%dT%H:%M:%SZ)"},
  {"speaker":"SE","text":"Great question. V1 calculates a composite risk index across endpoints, email, and network telemetry.","ts":"$(date -u -d @$((BASE_TS+18)) +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r $((BASE_TS+18)) +%Y-%m-%dT%H:%M:%SZ)"},
  {"speaker":"SE","text":"Here I can isolate a compromised endpoint with one click, and XDR correlates the detection automatically.","ts":"$(date -u -d @$((BASE_TS+30)) +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r $((BASE_TS+30)) +%Y-%m-%dT%H:%M:%SZ)"},
  {"speaker":"Visitor","text":"That's impressive. Can we see the detection detail?","ts":"$(date -u -d @$((BASE_TS+38)) +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r $((BASE_TS+38)) +%Y-%m-%dT%H:%M:%SZ)"}
]
ENDJSON

echo "[3/5] Uploading transcript/transcript.json ..."
${AWS} s3 cp "${TMP}/transcript.json" "${PREFIX}/transcript/transcript.json" --quiet

# --- 4. commands/end.json ---
END_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > "${TMP}/end.json" <<ENDJSON
{
  "session_id": "${ID}",
  "status": "ended",
  "ended_at": "${END_TS}"
}
ENDJSON

echo "[4/5] Uploading commands/end.json ..."
${AWS} s3 cp "${TMP}/end.json" "${PREFIX}/commands/end.json" --quiet

# --- 5. Update metadata with ended status ---
cat > "${TMP}/metadata-final.json" <<ENDJSON
{
  "session_id": "${ID}",
  "visitor_name": "Demo Visitor",
  "company": "Test Corp",
  "badge_photo": null,
  "started_at": "${NOW}",
  "ended_at": "${END_TS}",
  "demo_pc": "booth-pc-demo",
  "se_name": "Demo SE",
  "audio_consent": false,
  "status": "ended",
  "upload_complete": true
}
ENDJSON

echo "[5/5] Updating metadata.json with ended status ..."
${AWS} s3 cp "${TMP}/metadata-final.json" "${PREFIX}/metadata.json" --quiet

echo ""
echo "=== Demo session complete ==="
echo "Session ID: ${ID}"
echo "S3 path:    ${BUCKET}/sessions/${ID}/"
echo ""
echo "Verify with:"
echo "  ${AWS} s3 ls ${PREFIX}/ --recursive"
