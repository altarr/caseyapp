// =============================================================================
// SAMPLE DATA -- mock session data for offline testing
// When S3 is not available, this data is used to render the replay viewer.
// =============================================================================

var SAMPLE_METADATA = {
  "session_id": "B291047",
  "visitor_name": "Priya Sharma",
  "badge_photo": "badge.jpg",
  "started_at": "2026-08-06T10:15:00Z",
  "ended_at": "2026-08-06T10:32:00Z",
  "demo_pc": "booth-pc-1",
  "se_name": "Casey Mondoux",
  "audio_consent": true,
  "status": "completed"
};

var SAMPLE_CLICKS = {
  "session_id": "B291047",
  "events": [
    {
      "index": 1,
      "timestamp": "2026-08-06T10:15:18.042Z",
      "type": "click",
      "element": { "text": "Endpoint Security" },
      "page_title": "Vision One - Dashboard",
      "screenshot_file": "screenshots/click-001.jpg"
    },
    {
      "index": 2,
      "timestamp": "2026-08-06T10:16:05.210Z",
      "type": "click",
      "element": { "text": "BYOD Policy" },
      "page_title": "Vision One - Endpoint Security",
      "screenshot_file": "screenshots/click-002.jpg"
    },
    {
      "index": 3,
      "timestamp": "2026-08-06T10:17:44.882Z",
      "type": "click",
      "element": { "text": "Device Enrollment Settings" },
      "page_title": "Vision One - BYOD Policy",
      "screenshot_file": "screenshots/click-003.jpg"
    },
    {
      "index": 4,
      "timestamp": "2026-08-06T10:19:30.115Z",
      "type": "click",
      "element": { "text": "XDR" },
      "page_title": "Vision One - BYOD Policy",
      "screenshot_file": "screenshots/click-004.jpg"
    },
    {
      "index": 5,
      "timestamp": "2026-08-06T10:20:12.330Z",
      "type": "click",
      "element": { "text": "Workbench" },
      "page_title": "Vision One - XDR Overview",
      "screenshot_file": "screenshots/click-005.jpg"
    },
    {
      "index": 6,
      "timestamp": "2026-08-06T10:21:55.774Z",
      "type": "click",
      "element": { "text": "Suspicious PowerShell Execution" },
      "page_title": "Vision One - Workbench",
      "screenshot_file": "screenshots/click-006.jpg"
    },
    {
      "index": 7,
      "timestamp": "2026-08-06T10:23:40.089Z",
      "type": "click",
      "element": { "text": "Risk Insights" },
      "page_title": "Vision One - Alert Detail",
      "screenshot_file": "screenshots/click-007.jpg"
    },
    {
      "index": 8,
      "timestamp": "2026-08-06T10:24:18.450Z",
      "type": "click",
      "element": { "text": "BYOD Device Exposure" },
      "page_title": "Vision One - Risk Insights",
      "screenshot_file": "screenshots/click-008.jpg"
    },
    {
      "index": 9,
      "timestamp": "2026-08-06T10:26:05.900Z",
      "type": "click",
      "element": { "text": "Start Remediation Workflow" },
      "page_title": "Vision One - BYOD Exposure Detail",
      "screenshot_file": "screenshots/click-009.jpg"
    },
    {
      "index": 10,
      "timestamp": "2026-08-06T10:28:30.123Z",
      "type": "click",
      "element": { "text": "Endpoint Security" },
      "page_title": "Vision One - BYOD Exposure Detail",
      "screenshot_file": "screenshots/click-010.jpg"
    }
  ]
};

var SAMPLE_TRANSCRIPT = {
  "session_id": "B291047",
  "source": "recording.wav",
  "duration_seconds": 1020,
  "entries": [
    { "timestamp": "00:00:05.000", "speaker": "SE", "text": "Hi Priya, welcome to the TrendAI booth. I'm Casey. Let me show you Vision One \u2014 our unified security platform." },
    { "timestamp": "00:00:14.000", "speaker": "Visitor", "text": "Thanks. We're a mid-size financial firm, about 3,500 endpoints. Our biggest headache right now is BYOD \u2014 our employees use personal iPhones and Android devices to access corporate email." },
    { "timestamp": "00:00:28.000", "speaker": "SE", "text": "That's exactly one of Vision One's strongest areas. Let me start with Endpoint Security and show you how we handle BYOD specifically." },
    { "timestamp": "00:00:40.000", "speaker": "Visitor", "text": "Great. We looked at CrowdStrike Falcon Go for this but found the mobile coverage was limited." },
    { "timestamp": "00:01:02.000", "speaker": "SE", "text": "So here we are in Endpoint Security. This BYOD Policy panel lets you define enrollment requirements without requiring full MDM. The employee enrolls their device, and we apply a containerized workspace \u2014 corporate data stays isolated." },
    { "timestamp": "00:01:20.000", "speaker": "Visitor", "text": "Does this require installing a full MDM agent? Our employees pushed back hard when we tried MobileIron." },
    { "timestamp": "00:01:35.000", "speaker": "SE", "text": "No full MDM needed. It's a lightweight container app. The company never sees personal photos, texts, or apps. Here's the Device Enrollment Settings \u2014 you can see the options: require PIN, require OS version, but nothing that touches personal data." },
    { "timestamp": "00:02:10.000", "speaker": "Visitor", "text": "That's a key differentiator for us. Can we set different policies for iOS versus Android?" },
    { "timestamp": "00:02:22.000", "speaker": "SE", "text": "Yes, platform-specific policies are fully supported. You can see the iOS and Android tabs here. Let me jump over to XDR now to show you how endpoint telemetry feeds into threat detection." },
    { "timestamp": "00:04:18.000", "speaker": "SE", "text": "This is the XDR Workbench. All alerts from endpoint, email, and network sensors flow into here. This alert \u2014 Suspicious PowerShell Execution \u2014 was correlated from three separate endpoint events into one investigation." },
    { "timestamp": "00:04:35.000", "speaker": "Visitor", "text": "How long did it take to correlate that? Our current SIEM takes about 20 minutes to correlate events." },
    { "timestamp": "00:04:45.000", "speaker": "SE", "text": "This was under two minutes end-to-end. The correlation engine runs in real time. You can also see the attack chain visualization \u2014 it shows lateral movement attempts, which processes were spawned." },
    { "timestamp": "00:05:10.000", "speaker": "Visitor", "text": "That attack chain view is really useful. Can we integrate our existing Splunk deployment with this?" },
    { "timestamp": "00:05:22.000", "speaker": "SE", "text": "Yes, we have a native Splunk app, and you can push alerts from Workbench to Splunk via API. Now let me show you Risk Insights \u2014 this ties back to your BYOD concern." },
    { "timestamp": "00:08:15.000", "speaker": "SE", "text": "This is Risk Insights. This BYOD Device Exposure tile shows you your attack surface from unmanaged devices. Right now in this demo tenant, it's showing 47 devices with elevated risk." },
    { "timestamp": "00:08:30.000", "speaker": "Visitor", "text": "Can we set risk thresholds? Like, if a device risk score exceeds a certain level, automatically revoke access to corporate data?" },
    { "timestamp": "00:08:45.000", "speaker": "SE", "text": "Exactly \u2014 that's what this Remediation Workflow button kicks off. You define the thresholds, and Vision One automatically quarantines the container, sends a notification to the employee and IT, and logs the event. No manual steps." },
    { "timestamp": "00:09:05.000", "speaker": "Visitor", "text": "That automated response is what we need. We're currently doing this manually and it takes hours." },
    { "timestamp": "00:09:20.000", "speaker": "SE", "text": "Vision One is built to automate exactly those workflows. Let me take you back to the endpoint policy overview to show you the reporting capabilities." },
    { "timestamp": "00:13:00.000", "speaker": "Visitor", "text": "Overall this is impressive. The BYOD container approach and the automated risk response are the two things I want to explore further. What would a POC look like?" },
    { "timestamp": "00:13:20.000", "speaker": "SE", "text": "We can set up a POC in your environment in about a week. I'll connect you with our sales team \u2014 they can scope it for your 3,500 endpoints. You'll also get access to this exact tenant to continue exploring after the show." },
    { "timestamp": "00:13:45.000", "speaker": "Visitor", "text": "Perfect. And just to confirm \u2014 you support both cloud and on-prem data residency? We have regulatory requirements around data staying in the EU." },
    { "timestamp": "00:14:00.000", "speaker": "SE", "text": "Yes, we have EU-region tenants and data residency guarantees. Our compliance team can provide a Data Processing Agreement. I'll include that in the follow-up materials." }
  ]
};

var SAMPLE_SUMMARY = {
  "session_id": "B291047",
  "visitor_name": "Priya Sharma",
  "se_name": "Casey Mondoux",
  "demo_duration_seconds": 1020,
  "session_score": 8,
  "executive_summary": "Priya showed strong interest in BYOD containerization and automated risk response for her 3,500-endpoint financial firm. Schedule a POC scoping call within the week to capitalize on competitive evaluation against CrowdStrike.",
  "products_demonstrated": ["Endpoint Security", "XDR", "Risk Insights"],
  "key_interests": [
    { "topic": "BYOD Container Policy", "confidence": "high", "evidence": "Asked 3 detailed questions about MDM-free enrollment and platform-specific policies" },
    { "topic": "Automated Risk Remediation", "confidence": "high", "evidence": "Said 'That automated response is what we need' after seeing workflow demo" },
    { "topic": "XDR Correlation Speed", "confidence": "medium", "evidence": "Compared 20-min SIEM correlation to V1's sub-2-minute detection" },
    { "topic": "Splunk Integration", "confidence": "medium", "evidence": "Asked specifically about native Splunk app and API push" },
    { "topic": "EU Data Residency", "confidence": "low", "evidence": "Brief question about regulatory requirements at end of session" }
  ],
  "follow_up_actions": [
    "Send BYOD container deployment guide with iOS/Android comparison matrix",
    "Schedule POC scoping call for 3,500-endpoint environment within 5 business days",
    "Provide competitive comparison: V1 BYOD vs CrowdStrike Falcon Go mobile coverage",
    "Share EU data residency documentation and DPA template",
    "Connect with Splunk integration team for pre-POC architecture review"
  ],
  "key_moments": [
    { "timestamp": "01:20", "screenshot": "click-003.jpg", "description": "Visitor asked if BYOD requires full MDM", "impact": "Previous MobileIron pushback makes lightweight container a strong selling point" },
    { "timestamp": "04:35", "screenshot": "click-006.jpg", "description": "Visitor compared V1 correlation speed to their 20-minute SIEM", "impact": "Direct pain point \u2014 current tooling too slow for incident response" },
    { "timestamp": "09:05", "screenshot": "click-009.jpg", "description": "Visitor called automated remediation 'what we need'", "impact": "Strong buying signal \u2014 manual process taking hours today" }
  ],
  "v1_tenant_link": "https://portal.xdr.trendmicro.com/tenants/demo-B291047",
  "generated_at": "2026-08-06T10:35:00Z"
};
