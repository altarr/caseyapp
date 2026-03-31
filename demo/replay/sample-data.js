// Sample session data for testing the replay viewer
// In production, data is loaded from S3 session folder
var SAMPLE_DATA = {
  clicks: {
    session_id: 'demo-sample-001',
    events: [
      { index: 1, timestamp: '2026-03-30T14:00:05.000Z', offset_seconds: 5, dom_path: 'nav > a.dashboard', element_text: 'Dashboard', page_title: 'Vision One - Home', screenshot_url: '' },
      { index: 2, timestamp: '2026-03-30T14:00:32.000Z', offset_seconds: 32, dom_path: 'nav > a.xdr', element_text: 'XDR Detection', page_title: 'Vision One - Home', screenshot_url: '' },
      { index: 3, timestamp: '2026-03-30T14:01:15.000Z', offset_seconds: 75, dom_path: 'button.investigate', element_text: 'Investigate Alert', page_title: 'Vision One - XDR', screenshot_url: '' },
      { index: 4, timestamp: '2026-03-30T14:02:00.000Z', offset_seconds: 120, dom_path: 'div.workbench > button', element_text: 'Response Actions', page_title: 'Vision One - Workbench', screenshot_url: '' },
      { index: 5, timestamp: '2026-03-30T14:03:10.000Z', offset_seconds: 190, dom_path: 'nav > a.endpoint', element_text: 'Endpoint Inventory', page_title: 'Vision One - Workbench', screenshot_url: '' },
      { index: 6, timestamp: '2026-03-30T14:04:00.000Z', offset_seconds: 240, dom_path: 'button.isolate', element_text: 'Isolate Endpoint', page_title: 'Vision One - Endpoints', screenshot_url: '' },
      { index: 7, timestamp: '2026-03-30T14:05:20.000Z', offset_seconds: 320, dom_path: 'nav > a.risk', element_text: 'Attack Surface', page_title: 'Vision One - Endpoints', screenshot_url: '' },
      { index: 8, timestamp: '2026-03-30T14:06:45.000Z', offset_seconds: 405, dom_path: 'div.risk-card', element_text: 'Critical CVE-2026-1234', page_title: 'Vision One - Risk', screenshot_url: '' }
    ]
  },
  transcript: {
    duration_seconds: 420,
    entries: [
      { timestamp: '00:00:03.000', offset_seconds: 3, speaker: 'SE', text: 'Welcome! Let me show you Vision One, our unified cybersecurity platform.' },
      { timestamp: '00:00:15.000', offset_seconds: 15, speaker: 'Visitor', text: 'We have been looking at XDR solutions. How does this compare to CrowdStrike?' },
      { timestamp: '00:00:28.000', offset_seconds: 28, speaker: 'SE', text: 'Great question. Let me pull up XDR detection -- this is where we really differentiate.' },
      { timestamp: '00:01:05.000', offset_seconds: 65, speaker: 'SE', text: 'Notice how we correlate across email, endpoint, and network in a single view.' },
      { timestamp: '00:01:20.000', offset_seconds: 80, speaker: 'Visitor', text: 'That cross-layer visibility is exactly what we need. Our current tool only sees endpoints.' },
      { timestamp: '00:01:45.000', offset_seconds: 105, speaker: 'SE', text: 'Right. And from here I can investigate and respond immediately. Watch this.' },
      { timestamp: '00:02:10.000', offset_seconds: 130, speaker: 'SE', text: 'One click and we can isolate the endpoint, block the hash, and quarantine the file.' },
      { timestamp: '00:02:30.000', offset_seconds: 150, speaker: 'Visitor', text: 'Can your team do a POC in our environment? We have about 5000 endpoints.' },
      { timestamp: '00:03:00.000', offset_seconds: 180, speaker: 'SE', text: 'Absolutely. Let me also show you our endpoint inventory and risk scoring.' },
      { timestamp: '00:03:30.000', offset_seconds: 210, speaker: 'Visitor', text: 'We also need attack surface management. Do you cover that?' },
      { timestamp: '00:04:00.000', offset_seconds: 240, speaker: 'SE', text: 'Yes! Let me show you that. We can see every exposed asset and its risk level.' },
      { timestamp: '00:05:00.000', offset_seconds: 300, speaker: 'SE', text: 'Here is the attack surface view. We automatically discover internet-facing assets.' },
      { timestamp: '00:05:30.000', offset_seconds: 330, speaker: 'Visitor', text: 'Impressive. And the risk scoring integrates with your XDR data?' },
      { timestamp: '00:06:00.000', offset_seconds: 360, speaker: 'SE', text: 'Exactly. Risk scores factor in active threats, vulnerabilities, and exposure.' },
      { timestamp: '00:06:30.000', offset_seconds: 390, speaker: 'Visitor', text: 'This is great. Can we get a follow-up meeting next week?' },
      { timestamp: '00:06:50.000', offset_seconds: 410, speaker: 'SE', text: 'Absolutely. I will send you a summary of everything we covered today.' }
    ]
  },
  summary: {
    session_id: 'demo-sample-001',
    visitor_name: 'Sarah Chen',
    visitor_company: 'Acme Corp',
    se_name: 'Demo SE',
    demo_duration_minutes: 7,
    generated_at: '2026-03-30T14:07:00.000Z',
    products_shown: ['Vision One XDR', 'Endpoint Security', 'Attack Surface Risk Management'],
    visitor_interests: [
      { topic: 'XDR Cross-Layer Detection', confidence: 'high', evidence: 'Asked about CrowdStrike comparison, impressed by correlation' },
      { topic: 'Attack Surface Management', confidence: 'high', evidence: 'Specifically asked about ASM coverage' },
      { topic: 'Endpoint Response Actions', confidence: 'medium', evidence: 'Watched isolation demo with interest' }
    ],
    key_moments: [
      { timestamp: '00:00:15', description: 'Visitor mentioned evaluating CrowdStrike' },
      { timestamp: '00:02:30', description: 'Visitor requested POC for 5000 endpoints' },
      { timestamp: '00:06:30', description: 'Visitor requested follow-up meeting' }
    ],
    recommended_follow_up: [
      'Schedule POC for 5000-endpoint environment',
      'Send competitive comparison vs CrowdStrike XDR',
      'Arrange ASM deep-dive with product team',
      'Share customer success stories in their industry'
    ],
    key_insights: [
      'Evaluating CrowdStrike -- competitive displacement opportunity',
      'Pain point: limited to endpoint-only visibility today',
      'Budget holder engaged -- requested follow-up meeting',
      'Strong interest in ASM and risk scoring integration'
    ]
  }
};
