#!/usr/bin/env bash
# demo-simulate.sh -- Upload a realistic sample session to S3 for testing.
# Idempotent: re-running overwrites the same session files.
set -euo pipefail

BUCKET="s3://boothapp-sessions-752266476357"
AWS="aws --profile hackathon --region us-east-1"
ID="DEMO-1774898938"
DEMO_PC="booth-pc-3"
PREFIX="${BUCKET}/sessions/${ID}"
CMD_PREFIX="${BUCKET}/commands/${DEMO_PC}"

# Fixed timestamps for idempotent runs
START_TS="2026-08-06T14:00:00Z"
END_TS="2026-08-06T14:17:00Z"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "=== Demo Simulation: ${ID} ==="
echo "S3 path: ${PREFIX}/"
echo ""

# --- 1. metadata.json ---
cat > "${TMP}/metadata.json" <<'ENDJSON'
{
  "session_id": "DEMO-1774898938",
  "visitor_name": "Sarah Mitchell",
  "company": "Acme Corp",
  "badge_photo": "badge.jpg",
  "started_at": "2026-08-06T14:00:00Z",
  "ended_at": "2026-08-06T14:17:00Z",
  "demo_pc": "booth-pc-3",
  "se_name": "Casey Mondoux",
  "audio_consent": true,
  "status": "completed"
}
ENDJSON

echo "[1/6] Uploading metadata.json ..."
${AWS} s3 cp "${TMP}/metadata.json" "${PREFIX}/metadata.json" --quiet

# --- 2. clicks/clicks.json (8 V1 console clicks) ---
cat > "${TMP}/clicks.json" <<'ENDJSON'
{
  "session_id": "DEMO-1774898938",
  "events": [
    {
      "index": 1,
      "timestamp": "2026-08-06T14:00:22.410Z",
      "type": "click",
      "dom_path": "div.app-content > nav > a.xdr",
      "element": {
        "tag": "a",
        "id": "xdr-nav",
        "class": "nav-item xdr",
        "text": "XDR",
        "href": "/app/xdr"
      },
      "coordinates": {"x": 240, "y": 155},
      "page_url": "https://portal.xdr.trendmicro.com/app/dashboard",
      "page_title": "Vision One - Dashboard",
      "screenshot_file": "screenshots/click-001.jpg"
    },
    {
      "index": 2,
      "timestamp": "2026-08-06T14:01:45.880Z",
      "type": "click",
      "dom_path": "div.xdr-content > section.threat-investigation > a.workbench",
      "element": {
        "tag": "a",
        "id": "workbench-link",
        "class": "section-link workbench",
        "text": "Workbench",
        "href": "/app/xdr/workbench"
      },
      "coordinates": {"x": 490, "y": 260},
      "page_url": "https://portal.xdr.trendmicro.com/app/xdr",
      "page_title": "Vision One - XDR Overview",
      "screenshot_file": "screenshots/click-002.jpg"
    },
    {
      "index": 3,
      "timestamp": "2026-08-06T14:03:12.330Z",
      "type": "click",
      "dom_path": "div.workbench-alerts > table > tr:nth-child(1) > td > a",
      "element": {
        "tag": "a",
        "id": null,
        "class": "alert-link critical-severity",
        "text": "Ransomware Activity Detected",
        "href": "/app/xdr/workbench/alert-01192"
      },
      "coordinates": {"x": 670, "y": 285},
      "page_url": "https://portal.xdr.trendmicro.com/app/xdr/workbench",
      "page_title": "Vision One - Workbench",
      "screenshot_file": "screenshots/click-003.jpg"
    },
    {
      "index": 4,
      "timestamp": "2026-08-06T14:05:50.115Z",
      "type": "click",
      "dom_path": "div.app-content > nav > a.endpoint-security",
      "element": {
        "tag": "a",
        "id": "ep-nav",
        "class": "nav-item endpoint-security",
        "text": "Endpoint Security",
        "href": "/app/endpoint-security"
      },
      "coordinates": {"x": 240, "y": 110},
      "page_url": "https://portal.xdr.trendmicro.com/app/xdr/workbench/alert-01192",
      "page_title": "Vision One - Alert Detail",
      "screenshot_file": "screenshots/click-004.jpg"
    },
    {
      "index": 5,
      "timestamp": "2026-08-06T14:07:33.670Z",
      "type": "click",
      "dom_path": "div.ep-content > section > div.policy-list > a.policy-server",
      "element": {
        "tag": "a",
        "id": "policy-server",
        "class": "policy-item policy-server",
        "text": "Server Protection Policy",
        "href": "/app/endpoint-security/policies/server"
      },
      "coordinates": {"x": 610, "y": 380},
      "page_url": "https://portal.xdr.trendmicro.com/app/endpoint-security",
      "page_title": "Vision One - Endpoint Security",
      "screenshot_file": "screenshots/click-005.jpg"
    },
    {
      "index": 6,
      "timestamp": "2026-08-06T14:09:18.990Z",
      "type": "click",
      "dom_path": "div.app-content > nav > a.risk-insights",
      "element": {
        "tag": "a",
        "id": "risk-nav",
        "class": "nav-item risk-insights",
        "text": "Risk Insights",
        "href": "/app/risk-insights"
      },
      "coordinates": {"x": 240, "y": 200},
      "page_url": "https://portal.xdr.trendmicro.com/app/endpoint-security/policies/server",
      "page_title": "Vision One - Server Protection Policy",
      "screenshot_file": "screenshots/click-006.jpg"
    },
    {
      "index": 7,
      "timestamp": "2026-08-06T14:11:42.220Z",
      "type": "click",
      "dom_path": "div.risk-content > section.attack-surface > div.cve-exposure",
      "element": {
        "tag": "div",
        "id": "cve-exposure-tile",
        "class": "exposure-tile cve-exposure clickable",
        "text": "CVE Exposure Analysis",
        "href": null
      },
      "coordinates": {"x": 530, "y": 350},
      "page_url": "https://portal.xdr.trendmicro.com/app/risk-insights",
      "page_title": "Vision One - Risk Insights",
      "screenshot_file": "screenshots/click-007.jpg"
    },
    {
      "index": 8,
      "timestamp": "2026-08-06T14:13:55.440Z",
      "type": "click",
      "dom_path": "div.app-content > nav > a.zero-trust",
      "element": {
        "tag": "a",
        "id": "zt-nav",
        "class": "nav-item zero-trust",
        "text": "Zero Trust Secure Access",
        "href": "/app/zero-trust"
      },
      "coordinates": {"x": 240, "y": 245},
      "page_url": "https://portal.xdr.trendmicro.com/app/risk-insights/cve-exposure",
      "page_title": "Vision One - CVE Exposure",
      "screenshot_file": "screenshots/click-008.jpg"
    }
  ]
}
ENDJSON

echo "[2/6] Uploading clicks/clicks.json ..."
${AWS} s3 cp "${TMP}/clicks.json" "${PREFIX}/clicks/clicks.json" --quiet

# --- 3. transcript/transcript.json (15 dialogue entries) ---
cat > "${TMP}/transcript.json" <<'ENDJSON'
{
  "session_id": "DEMO-1774898938",
  "source": "recording.wav",
  "duration_seconds": 1020,
  "entries": [
    {
      "timestamp": "00:00:04.000",
      "speaker": "SE",
      "text": "Hi Sarah, welcome to the Trend Micro booth! I'm Casey. Let me show you Vision One, our unified cybersecurity platform."
    },
    {
      "timestamp": "00:00:12.000",
      "speaker": "Visitor",
      "text": "Thanks Casey. We're Acme Corp, about 8,000 endpoints across 12 offices. We've been dealing with a lot of ransomware scares lately."
    },
    {
      "timestamp": "00:00:22.000",
      "speaker": "SE",
      "text": "Ransomware is exactly where Vision One shines. Let me start with XDR -- our extended detection and response module. This is where all your telemetry comes together."
    },
    {
      "timestamp": "00:01:45.000",
      "speaker": "SE",
      "text": "Here's the Workbench -- all alerts from endpoint, email, and network sensors flow into this single view. You can see severity, affected assets, and the full attack chain."
    },
    {
      "timestamp": "00:02:05.000",
      "speaker": "Visitor",
      "text": "We're currently using Splunk as our SIEM but the correlation takes forever. How fast does this process alerts?"
    },
    {
      "timestamp": "00:02:18.000",
      "speaker": "SE",
      "text": "Real-time correlation -- typically under two minutes. Let me click into this ransomware alert to show you the investigation workflow."
    },
    {
      "timestamp": "00:03:12.000",
      "speaker": "SE",
      "text": "Here's the full attack chain visualization. You can see the initial phishing email, the macro execution, lateral movement, and the attempted encryption. All correlated automatically."
    },
    {
      "timestamp": "00:03:40.000",
      "speaker": "Visitor",
      "text": "That visualization is incredible. Can we set up automated response? Like isolating an endpoint the moment ransomware behavior is detected?"
    },
    {
      "timestamp": "00:03:55.000",
      "speaker": "SE",
      "text": "Absolutely. Vision One has playbooks that can auto-isolate, kill processes, and notify your SOC team -- all within seconds. Let me show you the endpoint protection side."
    },
    {
      "timestamp": "00:05:50.000",
      "speaker": "SE",
      "text": "This is Endpoint Security. These policies govern your 8,000 endpoints. I'm opening the Server Protection Policy since you mentioned ransomware -- servers are the high-value targets."
    },
    {
      "timestamp": "00:07:33.000",
      "speaker": "Visitor",
      "text": "We have a mix of Windows Server 2019 and 2022, plus some Linux boxes running Ubuntu. Does this cover both?"
    },
    {
      "timestamp": "00:07:48.000",
      "speaker": "SE",
      "text": "Full coverage for Windows Server and all major Linux distros. Same agent, same policy engine. Now let me show you Risk Insights -- this ties your exposure to real-world threats."
    },
    {
      "timestamp": "00:09:18.000",
      "speaker": "SE",
      "text": "Risk Insights gives you an attack surface view. This CVE Exposure tile shows unpatched vulnerabilities across your fleet ranked by exploitability. Right now this demo tenant has 23 critical CVEs."
    },
    {
      "timestamp": "00:11:42.000",
      "speaker": "Visitor",
      "text": "We've been struggling with patch prioritization. Having CVEs ranked by actual exploitability instead of just CVSS score would save us weeks. Does this integrate with our patching tools?"
    },
    {
      "timestamp": "00:13:55.000",
      "speaker": "SE",
      "text": "Yes -- native integrations with WSUS, SCCM, and third-party patch managers. And finally, let me show you Zero Trust Secure Access. This controls who gets into your network based on continuous risk assessment, not just one-time authentication."
    }
  ]
}
ENDJSON

echo "[3/6] Uploading transcript/transcript.json ..."
${AWS} s3 cp "${TMP}/transcript.json" "${PREFIX}/transcript/transcript.json" --quiet

# --- 4. commands/start.json ---
cat > "${TMP}/start.json" <<'ENDJSON'
{
  "session_id": "DEMO-1774898938",
  "demo_pc": "booth-pc-3",
  "started_at": "2026-08-06T14:00:00Z",
  "tenant_available": true
}
ENDJSON

echo "[4/6] Uploading commands/start.json ..."
${AWS} s3 cp "${TMP}/start.json" "${CMD_PREFIX}/start.json" --quiet

# --- 5. commands/end.json ---
cat > "${TMP}/end.json" <<'ENDJSON'
{
  "session_id": "DEMO-1774898938",
  "demo_pc": "booth-pc-3",
  "ended_at": "2026-08-06T14:17:00Z"
}
ENDJSON

echo "[5/6] Uploading commands/end.json ..."
${AWS} s3 cp "${TMP}/end.json" "${CMD_PREFIX}/end.json" --quiet

# --- 6. Verify uploads ---
echo "[6/6] Verifying uploads ..."
echo ""
echo "Session files:"
${AWS} s3 ls "${PREFIX}/" --recursive
echo ""
echo "Command files:"
${AWS} s3 ls "${CMD_PREFIX}/"
echo ""
echo "=== Done ==="
echo "Session ID: ${ID}"
echo "Visitor:    Sarah Mitchell (Acme Corp)"
echo "Clicks:     8 events (XDR, Workbench, Endpoints, Policies, Risk, Zero Trust)"
echo "Transcript: 15 entries (ransomware discussion, CVE prioritization, ZTSA)"
