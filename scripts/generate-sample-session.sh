#!/usr/bin/env bash
# generate-sample-session.sh — Generate realistic demo session data in S3.
#
# Creates a complete session with randomized persona, 8-12 V1 clicks,
# and 20-30 transcript entries spanning 10-20 minutes. The watcher
# auto-detects the completed session and runs full Bedrock analysis.
#
# Usage:
#   bash scripts/generate-sample-session.sh                  # random persona
#   bash scripts/generate-sample-session.sh "Jane Park"      # named visitor
#   bash scripts/generate-sample-session.sh --no-wait        # skip polling
#
# Requires: aws CLI (hackathon profile), python3
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BUCKET="boothapp-sessions-752266476357"
REGION="us-east-1"
PROFILE="hackathon"
DEMO_PC="booth-pc-3"
AWS="aws --profile ${PROFILE} --region ${REGION}"

# ── Args ──────────────────────────────────────────────────────────────────────
VISITOR_NAME=""
WAIT=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-wait) WAIT=false; shift ;;
    -h|--help)
      echo "Usage: $0 [visitor-name] [--no-wait]"
      echo ""
      echo "  visitor-name   Optional visitor name (random persona if omitted)"
      echo "  --no-wait      Upload data only, skip polling for analysis output"
      exit 0 ;;
    -*) echo "Unknown option: $1"; exit 1 ;;
    *)  VISITOR_NAME="$1"; shift ;;
  esac
done

# ── Personas ──────────────────────────────────────────────────────────────────
# 5 realistic personas with distinct backgrounds and interests
pick_persona() {
  local idx=$(( RANDOM % 5 ))
  case $idx in
    0) P_NAME="Diana Chen"
       P_TITLE="Chief Executive Officer"
       P_COMPANY="Meridian Financial Group"
       P_ENDPOINTS=12000
       P_INDUSTRY="Financial Services"
       P_INTEREST="platform consolidation and board-level risk metrics"
       P_CURRENT="Palo Alto Cortex XDR + CrowdStrike Falcon"
       P_CONCERN="reducing vendor sprawl while maintaining compliance"
       ;;
    1) P_NAME="Marcus Thompson"
       P_TITLE="VP of Security Operations"
       P_COMPANY="NovaTech Industries"
       P_ENDPOINTS=8500
       P_INDUSTRY="Manufacturing"
       P_INTEREST="OT/IT convergence and supply chain threat detection"
       P_CURRENT="Symantec Endpoint + Splunk SIEM"
       P_CONCERN="operational technology blind spots and legacy integration"
       ;;
    2) P_NAME="Rachel Okafor"
       P_TITLE="Chief Information Security Officer"
       P_COMPANY="Pinnacle Healthcare Systems"
       P_ENDPOINTS=15000
       P_INDUSTRY="Healthcare"
       P_INTEREST="HIPAA compliance, ransomware protection, and cloud workload security"
       P_CURRENT="Microsoft Defender for Endpoint + Sentinel"
       P_CONCERN="multi-cloud visibility and zero-day response times"
       ;;
    3) P_NAME="James Kowalski"
       P_TITLE="Security Engineering Manager"
       P_COMPANY="Atlas Cloud Solutions"
       P_ENDPOINTS=4200
       P_INDUSTRY="Technology / SaaS"
       P_INTEREST="container security, CI/CD pipeline protection, and API threat detection"
       P_CURRENT="CrowdStrike Falcon + custom SIEM on ELK"
       P_CONCERN="cloud-native workload visibility and detection engineering velocity"
       ;;
    4) P_NAME="Sandra Vasquez"
       P_TITLE="IT Director"
       P_COMPANY="Crestline Retail Corp"
       P_ENDPOINTS=6800
       P_INDUSTRY="Retail"
       P_INTEREST="POS endpoint protection, email security, and PCI DSS compliance"
       P_CURRENT="McAfee ePO + Proofpoint Email"
       P_CONCERN="seasonal workforce endpoint management and phishing resilience"
       ;;
  esac
}

pick_persona

# Override name if provided on command line (keep the rest of the persona)
if [ -n "$VISITOR_NAME" ]; then
  P_NAME="$VISITOR_NAME"
fi

# ── Session ID & Timestamps ──────────────────────────────────────────────────
SESSION_ID="DEMO$(date +%s)"
PREFIX="sessions/${SESSION_ID}"
S3_PREFIX="s3://${BUCKET}/${PREFIX}"
CMD_PREFIX="s3://${BUCKET}/commands/${DEMO_PC}"

# Random duration between 10-20 minutes (600-1200 seconds)
DURATION=$(( 600 + RANDOM % 601 ))
START_EPOCH=$(date +%s)

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Portable timestamp helpers (Linux date -d vs macOS date -r)
ts_at() {
  local epoch=$1
  date -u -d @"${epoch}" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
    || date -u -r "${epoch}" +%Y-%m-%dT%H:%M:%SZ
}

ts_at_ms() {
  local epoch=$1
  date -u -d @"${epoch}" +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null \
    || date -u -r "${epoch}" +%Y-%m-%dT%H:%M:%S.000Z
}

mmss() {
  local secs=$1
  printf "%02d:%02d:%02d.000" $(( secs / 3600 )) $(( (secs % 3600) / 60 )) $(( secs % 60 ))
}

START_TS=$(ts_at "$START_EPOCH")
END_EPOCH=$(( START_EPOCH + DURATION ))
END_TS=$(ts_at "$END_EPOCH")

echo "================================================================"
echo "  BoothApp Sample Session Generator"
echo "  Session:   ${SESSION_ID}"
echo "  Visitor:   ${P_NAME} (${P_TITLE})"
echo "  Company:   ${P_COMPANY} (${P_ENDPOINTS} endpoints)"
echo "  Industry:  ${P_INDUSTRY}"
echo "  Duration:  $(( DURATION / 60 ))m $(( DURATION % 60 ))s"
echo "  Bucket:    s3://${BUCKET}"
echo "================================================================"
echo ""

# ── Step 1: metadata.json ────────────────────────────────────────────────────
echo "[1/5] Uploading metadata.json ..."

cat > "${TMP}/metadata.json" <<ENDJSON
{
  "session_id": "${SESSION_ID}",
  "visitor_name": "${P_NAME}",
  "company": "${P_COMPANY}",
  "badge_photo": "badge.jpg",
  "started_at": "${START_TS}",
  "ended_at": null,
  "demo_pc": "${DEMO_PC}",
  "se_name": "Casey Mondoux",
  "audio_consent": true,
  "status": "active",
  "upload_complete": false
}
ENDJSON
${AWS} s3 cp "${TMP}/metadata.json" "${S3_PREFIX}/metadata.json" --quiet
echo "  -> metadata.json (${P_NAME}, ${P_TITLE} @ ${P_COMPANY})"

# ── Step 2: clicks.json (8-12 V1 clicks) ─────────────────────────────────────
echo ""
echo "[2/5] Generating clicks.json ..."

# Build clicks using python3 for cleaner JSON generation
python3 > "${TMP}/clicks.json" <<PYEOF
import json, random

session_id = "${SESSION_ID}"
start_epoch = ${START_EPOCH}
duration = ${DURATION}

# Pool of realistic V1 click targets — more than 12 so we get variety
click_pool = [
    {
        "dom_path": "div#menuxdr_app > span.ant-menu-title",
        "element": {"tag": "span", "id": "xdr-nav", "class": "ant-menu-title", "text": "XDR Threat Investigation", "href": "/app/xdr"},
        "coords": {"x": 85, "y": 320},
        "page_url": "https://portal.xdr.trendmicro.com/app/dashboard",
        "page_title": "Vision One - Dashboard"
    },
    {
        "dom_path": "table.workbench-alerts > tbody > tr:nth-child(1) > td.alert-name",
        "element": {"tag": "td", "id": "", "class": "alert-name critical-severity", "text": "Ransomware Activity Detected - WORM_LOCKBIT.A", "href": None},
        "coords": {"x": 520, "y": 290},
        "page_url": "https://portal.xdr.trendmicro.com/app/xdr/workbench",
        "page_title": "Vision One - XDR Workbench"
    },
    {
        "dom_path": "div.workbench-detail > button.investigate",
        "element": {"tag": "button", "id": "btn-investigate", "class": "ant-btn-primary investigate", "text": "Investigate in Search", "href": None},
        "coords": {"x": 780, "y": 155},
        "page_url": "https://portal.xdr.trendmicro.com/app/xdr/workbench/WB-20260331-00042",
        "page_title": "Vision One - Workbench Alert Detail"
    },
    {
        "dom_path": "div.search-app > input.search-bar",
        "element": {"tag": "input", "id": "search-input", "class": "search-bar ant-input", "text": "", "href": None},
        "coords": {"x": 640, "y": 130},
        "page_url": "https://portal.xdr.trendmicro.com/app/search",
        "page_title": "Vision One - Search"
    },
    {
        "dom_path": "div.search-results > table > tbody > tr:nth-child(3)",
        "element": {"tag": "tr", "id": "", "class": "search-result-row", "text": "endpoint-host-activity: ACME-WS-0142 executed suspicious PowerShell", "href": None},
        "coords": {"x": 550, "y": 380},
        "page_url": "https://portal.xdr.trendmicro.com/app/search?query=lockbit",
        "page_title": "Vision One - Search Results"
    },
    {
        "dom_path": "div#menuendpoint_security_operations > span.ant-menu-title",
        "element": {"tag": "span", "id": "ep-nav", "class": "ant-menu-title", "text": "Endpoint Security", "href": "/app/endpoint-security"},
        "coords": {"x": 85, "y": 420},
        "page_url": "https://portal.xdr.trendmicro.com/app/search?query=lockbit",
        "page_title": "Vision One - Search Results"
    },
    {
        "dom_path": "div.ep-content > section > div.policy-list > a.policy-endpoint",
        "element": {"tag": "a", "id": "policy-ep", "class": "policy-item", "text": "Endpoint Protection Policy", "href": "/app/endpoint-security/policies/endpoint"},
        "coords": {"x": 610, "y": 340},
        "page_url": "https://portal.xdr.trendmicro.com/app/endpoint-security",
        "page_title": "Vision One - Endpoint Security Operations"
    },
    {
        "dom_path": "div.risk-insights > div.risk-score-card",
        "element": {"tag": "div", "id": "risk-card", "class": "risk-score-card", "text": "Risk Score: 72/100 - Medium", "href": None},
        "coords": {"x": 450, "y": 260},
        "page_url": "https://portal.xdr.trendmicro.com/app/risk-insights/overview",
        "page_title": "Vision One - Risk Insights"
    },
    {
        "dom_path": "div.risk-insights > section.attack-surface > a.view-details",
        "element": {"tag": "a", "id": "attack-surface-link", "class": "view-details", "text": "View Attack Surface Details", "href": "/app/risk-insights/attack-surface"},
        "coords": {"x": 680, "y": 410},
        "page_url": "https://portal.xdr.trendmicro.com/app/risk-insights/overview",
        "page_title": "Vision One - Risk Insights"
    },
    {
        "dom_path": "div.attack-surface > div.internet-facing > span.device-count",
        "element": {"tag": "span", "id": "", "class": "device-count high-risk", "text": "23 Internet-Facing Devices with Critical Vulnerabilities", "href": None},
        "coords": {"x": 520, "y": 310},
        "page_url": "https://portal.xdr.trendmicro.com/app/risk-insights/attack-surface",
        "page_title": "Vision One - Attack Surface Discovery"
    },
    {
        "dom_path": "div#menunetwork_security_operations > span.ant-menu-title",
        "element": {"tag": "span", "id": "net-nav", "class": "ant-menu-title", "text": "Network Security", "href": "/app/network-security"},
        "coords": {"x": 85, "y": 560},
        "page_url": "https://portal.xdr.trendmicro.com/app/risk-insights/attack-surface",
        "page_title": "Vision One - Attack Surface Discovery"
    },
    {
        "dom_path": "div.network-analytics > div.detection-card:nth-child(1)",
        "element": {"tag": "div", "id": "", "class": "detection-card", "text": "Lateral Movement Detected - SMB Brute Force from 10.1.5.22", "href": None},
        "coords": {"x": 490, "y": 350},
        "page_url": "https://portal.xdr.trendmicro.com/app/network-security/analytics",
        "page_title": "Vision One - Network Analytics"
    },
    {
        "dom_path": "div#menuemail_security_operations > span.ant-menu-title",
        "element": {"tag": "span", "id": "email-nav", "class": "ant-menu-title", "text": "Email Security", "href": "/app/email-security"},
        "coords": {"x": 85, "y": 490},
        "page_url": "https://portal.xdr.trendmicro.com/app/network-security/analytics",
        "page_title": "Vision One - Network Analytics"
    },
    {
        "dom_path": "div.email-quarantine > table > tbody > tr:nth-child(1)",
        "element": {"tag": "tr", "id": "", "class": "quarantine-row phishing", "text": "BEC: Urgent Wire Transfer Request - cfo@spoofed-domain.com", "href": None},
        "coords": {"x": 590, "y": 320},
        "page_url": "https://portal.xdr.trendmicro.com/app/email-security/quarantine",
        "page_title": "Vision One - Email Quarantine"
    },
    {
        "dom_path": "div#menuzero_trust > span.ant-menu-title",
        "element": {"tag": "span", "id": "zt-nav", "class": "ant-menu-title", "text": "Zero Trust Secure Access", "href": "/app/zero-trust"},
        "coords": {"x": 85, "y": 600},
        "page_url": "https://portal.xdr.trendmicro.com/app/email-security/quarantine",
        "page_title": "Vision One - Email Quarantine"
    },
    {
        "dom_path": "div.zt-dashboard > div.risk-posture > canvas.risk-chart",
        "element": {"tag": "canvas", "id": "zt-risk-chart", "class": "risk-chart", "text": "Device Risk Posture", "href": None},
        "coords": {"x": 710, "y": 380},
        "page_url": "https://portal.xdr.trendmicro.com/app/zero-trust/dashboard",
        "page_title": "Vision One - Zero Trust Dashboard"
    }
]

# Pick 8-12 clicks in order (simulate a real demo flow)
num_clicks = random.randint(8, 12)
selected = click_pool[:num_clicks]  # take first N to maintain logical flow

# Space clicks across the session duration
events = []
for i, click in enumerate(selected):
    # Distribute clicks with some randomness
    base_offset = int(duration * (i + 1) / (num_clicks + 2))
    jitter = random.randint(-15, 15)
    offset = max(5, base_offset + jitter)
    ts_epoch = start_epoch + offset
    from datetime import datetime, timezone
    ts = datetime.fromtimestamp(ts_epoch, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{random.randint(100,999)}Z"

    events.append({
        "index": i + 1,
        "timestamp": ts,
        "type": "click",
        "dom_path": click["dom_path"],
        "element": click["element"],
        "coordinates": click["coords"],
        "page_url": click["page_url"],
        "page_title": click["page_title"],
        "screenshot_file": f"screenshots/click-{i+1:03d}.jpg"
    })

output = {
    "session_id": session_id,
    "events": events
}

print(json.dumps(output, indent=2))
PYEOF

${AWS} s3 cp "${TMP}/clicks.json" "${S3_PREFIX}/clicks/clicks.json" --quiet
NUM_CLICKS=$(python3 -c "import json; print(len(json.load(open('${TMP}/clicks.json'))['events']))")
echo "  -> clicks/clicks.json (${NUM_CLICKS} V1 console clicks)"

# ── Step 3: transcript.json (20-30 entries) ───────────────────────────────────
echo ""
echo "[3/5] Generating transcript.json ..."

python3 > "${TMP}/transcript.json" <<PYEOF
import json, random

session_id = "${SESSION_ID}"
duration = ${DURATION}
p_name = "${P_NAME}"
p_title = "${P_TITLE}"
p_company = "${P_COMPANY}"
p_endpoints = ${P_ENDPOINTS}
p_industry = "${P_INDUSTRY}"
p_interest = "${P_INTEREST}"
p_current = "${P_CURRENT}"
p_concern = "${P_CONCERN}"

# Build a realistic demo conversation tailored to the persona
entries = [
    # -- Opening (0:00 - 1:00) --
    ("SE", f"Welcome to the TrendAI booth! I'm Casey. What brings you to the show today?"),
    ("Visitor", f"Hi Casey. I'm {p_name}, {p_title} at {p_company}. We're a {p_industry.lower()} company with about {p_endpoints:,} endpoints. I'm particularly interested in {p_interest}."),
    ("SE", f"Great to meet you, {p_name.split()[0]}. {p_company} sounds like a perfect fit for Vision One. What are you running today for security?"),
    ("Visitor", f"We're currently on {p_current}. Honestly, our biggest pain point is {p_concern}."),
    ("SE", "I hear that from a lot of teams in your space. Let me show you how Vision One addresses that head-on. I'll start with the XDR Workbench -- this is the unified detection layer."),

    # -- XDR Workbench (1:00 - 4:00) --
    ("SE", "Everything flows into this single pane -- endpoint telemetry, email events, network detections, cloud workload alerts. No more swiveling between three consoles."),
    ("Visitor", "That's exactly our problem. Our SOC analysts waste half their shift correlating data across tools manually."),
    ("SE", "Watch this -- I'll click into this ransomware alert. Vision One automatically correlates the email that delivered the payload, the endpoint that executed it, and the lateral movement across the network. One alert, full kill chain."),
    ("Visitor", "How long does that correlation take? With our current setup it's easily 30 to 45 minutes per incident."),
    ("SE", "It's real-time. The moment the detection fires, the correlation engine links all related telemetry. Your analysts see the full picture in seconds, not minutes."),
    ("Visitor", f"That would be a game changer for us. We handle about {random.randint(50, 200)} alerts a day and the manual correlation is killing our response times."),

    # -- Search & Investigation (4:00 - 7:00) --
    ("SE", "Now let me show you the Search capability. Think of it as threat hunting built directly into the platform. I can search across all data sources with a single query."),
    ("Visitor", "Is that similar to what we'd do in Splunk or our SIEM?"),
    ("SE", "Similar concept, but the data is already normalized and enriched. No custom parsers, no field extraction rules. I just searched for the ransomware indicator and got endpoint activity, email delivery, and network connections -- all in one result set."),
    ("Visitor", "What about custom detection rules? Our security engineers have built a lot of custom Sigma rules that we'd need to migrate."),
    ("SE", "Vision One supports custom detection models. You can import Sigma rules or write YARA rules. They run against the same correlated data lake, so your custom detections benefit from the cross-layer visibility automatically."),

    # -- Risk Insights (7:00 - 10:00) --
    ("SE", "Let me show you something your board will love -- Risk Insights. This gives you a quantified risk score across your entire attack surface."),
    ("Visitor", "We've been trying to build risk dashboards manually. Our CISO presents to the board quarterly and it takes weeks to compile the data."),
    ("SE", "This is continuous and automatic. See the risk score here? It factors in unpatched vulnerabilities, misconfigured endpoints, accounts with weak authentication, and internet-facing assets with known CVEs. The attack surface view shows exactly where you're exposed."),
    ("Visitor", f"Can it show risk by business unit? Our {p_industry.lower()} operations have very different risk profiles than corporate IT."),
    ("SE", "Absolutely. You can segment by AD group, subnet, asset tag, or custom labels. Each segment gets its own risk score and trend line."),
    ("Visitor", "That competitive displacement angle is interesting. How does this compare to what CrowdStrike or Palo Alto offer for risk quantification?"),
    ("SE", "Neither of them provides native attack surface risk scoring with the same breadth. CrowdStrike focuses on endpoint risk; Palo Alto's Cortex XSIAM has some risk features but requires significant custom configuration. Vision One does it out of the box across endpoint, email, network, and cloud."),

    # -- Endpoint Security & Cloud (10:00 - 14:00) --
    ("SE", "Now for Endpoint Security -- this is where the rubber meets the road for your day-to-day operations."),
    ("Visitor", "How do you handle policy management for a distributed workforce? We have people in 12 countries."),
    ("SE", "Policy inheritance with geo-based overrides. You define a global baseline, then create overrides per region, department, or device type. Changes push in real-time through the agent."),
    ("Visitor", "What about cloud workloads? We're running about 400 containers on EKS and another 200 VMs on AWS."),
    ("SE", "Vision One covers that natively. Cloud workload protection for containers, serverless, and VMs. Same console, same detection engine, same correlated view. You don't need a separate CSPM tool."),
    ("Visitor", "That's significant. Right now we're running a separate container security tool and it's another console our team has to monitor."),

    # -- Email Security & Wrap-up (14:00 - end) --
    ("SE", "Last thing I want to show you -- email security. You mentioned phishing resilience is a concern. Vision One integrates email security so that when a phishing email is detected, it automatically correlates with any endpoint activity from users who clicked."),
    ("Visitor", "Can it do retroactive sweeps? We had an incident last quarter where a phishing campaign bypassed our gateway and we didn't catch it for three days."),
    ("SE", "Yes -- one-click sweep across all mailboxes. It'll find every variant of the message, quarantine them, and show you which users interacted with the email. Plus the XDR correlation will flag any post-click activity on those endpoints."),
    ("Visitor", f"This is really compelling. I need to get my team looking at this seriously. Can we get a trial tenant to connect our {p_industry.lower()} environment?"),
    ("SE", f"Absolutely. We'll set up a dedicated 30-day tenant for {p_company} with full access. I'll send you a personalized summary of everything we covered today plus the tenant credentials. Great meeting you, {p_name.split()[0]}!"),
    ("Visitor", "Thanks Casey, this was one of the best demos I've seen at the show. Looking forward to the follow-up."),
]

# Pick 20-30 entries (we have ~30 above, trim randomly if needed)
num_entries = random.randint(20, min(30, len(entries)))
selected = entries[:num_entries]

# Space entries across the session duration
formatted = []
for i, (speaker, text) in enumerate(selected):
    offset_secs = int(duration * (i + 0.5) / (len(selected) + 1))
    # Add small jitter
    offset_secs = max(3, offset_secs + random.randint(-3, 3))
    ts = f"{offset_secs // 3600:02d}:{(offset_secs % 3600) // 60:02d}:{offset_secs % 60:02d}.000"
    formatted.append({
        "timestamp": ts,
        "speaker": speaker,
        "text": text
    })

output = {
    "session_id": session_id,
    "source": "recording.wav",
    "duration_seconds": duration,
    "entries": formatted
}

print(json.dumps(output, indent=2))
PYEOF

${AWS} s3 cp "${TMP}/transcript.json" "${S3_PREFIX}/transcript/transcript.json" --quiet
NUM_ENTRIES=$(python3 -c "import json; print(len(json.load(open('${TMP}/transcript.json'))['entries']))")
echo "  -> transcript/transcript.json (${NUM_ENTRIES} dialogue entries)"

# ── Step 4: Placeholder audio + trigger analysis ──────────────────────────────
echo ""
echo "[4/5] Uploading audio placeholder + triggering analysis ..."

# Minimal WAV header (1 second silence)
python3 -c "
import struct, sys
sr, ch, bits, dur = 44100, 2, 16, 1
n = sr * dur * ch
ds = n * (bits // 8)
h = struct.pack('<4sI4s4sIHHIIHH4sI',
    b'RIFF', 36+ds, b'WAVE', b'fmt ', 16, 1, ch, sr, sr*ch*bits//8, ch*bits//8, bits, b'data', ds)
sys.stdout.buffer.write(h + b'\x00' * ds)
" > "${TMP}/recording.wav"
${AWS} s3 cp "${TMP}/recording.wav" "${S3_PREFIX}/audio/recording.wav" --quiet
echo "  -> audio/recording.wav (placeholder)"

# Write end.json to commands path
cat > "${TMP}/end.json" <<ENDJSON
{
  "session_id": "${SESSION_ID}",
  "demo_pc": "${DEMO_PC}",
  "ended_at": "${END_TS}"
}
ENDJSON
${AWS} s3 cp "${TMP}/end.json" "${CMD_PREFIX}/end.json" --quiet
${AWS} s3 cp "${TMP}/end.json" "${S3_PREFIX}/commands/end.json" --quiet

# Update metadata to completed (triggers watcher)
cat > "${TMP}/metadata-final.json" <<ENDJSON
{
  "session_id": "${SESSION_ID}",
  "visitor_name": "${P_NAME}",
  "company": "${P_COMPANY}",
  "badge_photo": "badge.jpg",
  "started_at": "${START_TS}",
  "ended_at": "${END_TS}",
  "demo_pc": "${DEMO_PC}",
  "se_name": "Casey Mondoux",
  "audio_consent": true,
  "status": "completed",
  "upload_complete": true
}
ENDJSON
${AWS} s3 cp "${TMP}/metadata-final.json" "${S3_PREFIX}/metadata.json" --quiet
echo "  -> metadata.json updated (status=completed)"

# ── Step 5: Verify & poll ────────────────────────────────────────────────────
echo ""
echo "[5/5] Verifying uploads ..."
echo ""
echo "Session files:"
${AWS} s3 ls "s3://${BUCKET}/${PREFIX}/" --recursive | sed 's/^/  /'

if [ "$WAIT" = false ]; then
  echo ""
  echo "================================================================"
  echo "  Session uploaded (--no-wait). Watcher will auto-detect."
  echo "  Session:  ${SESSION_ID}"
  echo "  Visitor:  ${P_NAME} (${P_TITLE})"
  echo "  Company:  ${P_COMPANY}"
  echo "  Check:    ${AWS} s3 ls ${S3_PREFIX}/output/"
  echo "================================================================"
  exit 0
fi

echo ""
echo "Waiting for analysis output (watcher polls every 30s, analysis ~1-3 min) ..."

TIMEOUT=600
POLL=10
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
  if ${AWS} s3 ls "${S3_PREFIX}/output/summary.json" >/dev/null 2>&1; then
    echo ""
    echo "================================================================"
    echo "  Analysis complete!"
    echo "================================================================"
    echo ""

    ${AWS} s3 cp "${S3_PREFIX}/output/summary.json" "${TMP}/summary.json" --quiet
    echo "--- SUMMARY REPORT ---"
    if command -v jq &>/dev/null; then
      jq '.' "${TMP}/summary.json"
    else
      python3 -m json.tool "${TMP}/summary.json"
    fi
    echo "--- END REPORT ---"

    echo ""
    echo "All output files:"
    ${AWS} s3 ls "${S3_PREFIX}/output/" | sed 's/^/  /'

    echo ""
    echo "================================================================"
    echo "  Session:  ${SESSION_ID}"
    echo "  Visitor:  ${P_NAME} (${P_TITLE} @ ${P_COMPANY})"
    echo "  Duration: $(( DURATION / 60 ))m $(( DURATION % 60 ))s"
    echo "================================================================"
    exit 0
  fi

  MINS=$(( ELAPSED / 60 ))
  SECS=$(( ELAPSED % 60 ))
  STAGE=""
  if ${AWS} s3 ls "${S3_PREFIX}/output/summary.html" >/dev/null 2>&1; then
    STAGE=" [html done, json rendering]"
  elif ${AWS} s3 ls "${S3_PREFIX}/output/.analysis-claimed" >/dev/null 2>&1; then
    STAGE=" [pipeline running]"
  fi
  printf "\r  [%02d:%02d] Waiting ...%-40s" "$MINS" "$SECS" "$STAGE"

  sleep $POLL
  ELAPSED=$(( ELAPSED + POLL ))
done

echo ""
echo "================================================================"
echo "  TIMEOUT after ${TIMEOUT}s -- summary.json not found"
echo "================================================================"
echo ""
echo "Troubleshooting:"
echo "  1. Is the watcher running?"
echo "     S3_BUCKET=${BUCKET} AWS_REGION=${REGION} node analysis/watcher.js"
echo ""
echo "  2. Check output so far:"
echo "     ${AWS} s3 ls ${S3_PREFIX}/output/"
echo ""
echo "  3. Run pipeline manually:"
echo "     node analysis/pipeline-run.js ${SESSION_ID} ${BUCKET}"
exit 1
