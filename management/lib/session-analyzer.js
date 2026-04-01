'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const RONE_KEY = process.env.RONE_AI_API_KEY;
const RONE_URL = process.env.RONE_AI_BASE_URL;

const client = new Anthropic({
  apiKey: RONE_KEY || process.env.ANTHROPIC_API_KEY,
  ...(RONE_URL && {
    baseURL: RONE_URL,
    defaultHeaders: { 'Authorization': `Bearer ${RONE_KEY}` },
  }),
});
const MODEL = process.env.ANALYSIS_MODEL || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are analyzing a recorded demo session from a trade show booth. You will receive:
- Audio recording of the conversation between a Sales Engineer (SE) and a booth visitor
- Screenshots captured during the demo (one per second, with timecodes)
- Optionally, click tracking data showing what the SE navigated to

Your job is to produce a clear, concise summary of the session. Focus on:
1. Who the visitor is (name, company, role/title if mentioned)
2. What products/features were shown in the demo (from the screenshots)
3. What was discussed in the conversation (from the audio)
4. What the visitor was most interested in
5. Recommended follow-up actions

Be specific and factual. Reference what you actually see in screenshots and hear in audio.
Do not hallucinate or infer things not evidenced in the data.`;

const USER_PROMPT = `Analyze this demo session and produce a summary in this exact format:

VISITOR: [Full name as mentioned in conversation or from badge scan]
COMPANY: [Company name]
ROLE: [Job title or role if mentioned, otherwise "Not mentioned"]

DEMO SUMMARY:
[2-4 sentences describing what products and features were demonstrated, based on what you see in the screenshots]

CONVERSATION SUMMARY:
[3-5 sentences summarizing the key discussion points from the audio — what questions were asked, what pain points were mentioned, what the SE explained]

KEY INTERESTS:
- [Bullet points of what the visitor seemed most interested in, with evidence]

RECOMMENDED FOLLOW-UP:
- [Bullet points of suggested next steps based on the conversation and interests shown]`;

/**
 * Sample screenshots evenly across the session.
 * Returns array of { filename, base64, timecode }
 */
function sampleScreenshots(sessionDir, maxCount = 15) {
  const dir = path.join(sessionDir, 'screenshots');
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
    .sort();

  if (files.length === 0) return [];
  if (files.length <= maxCount) {
    return files.map(f => ({
      filename: f,
      base64: fs.readFileSync(path.join(dir, f)).toString('base64'),
      timecode: f.replace('screenshot_', '').replace('.jpg', '').replace('.png', ''),
    }));
  }

  // Sample evenly
  const step = files.length / maxCount;
  const sampled = [];
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.floor(i * step);
    const f = files[idx];
    sampled.push({
      filename: f,
      base64: fs.readFileSync(path.join(dir, f)).toString('base64'),
      timecode: f.replace('screenshot_', '').replace('.jpg', '').replace('.png', ''),
    });
  }
  return sampled;
}

/**
 * Load audio file as base64.
 */
function loadAudio(sessionDir) {
  const audioDir = path.join(sessionDir, 'audio');
  if (!fs.existsSync(audioDir)) return null;

  const formats = [
    { file: 'recording.m4a', mediaType: 'audio/mp4' },
    { file: 'recording.wav', mediaType: 'audio/wav' },
    { file: 'recording.mp3', mediaType: 'audio/mpeg' },
    { file: 'recording.webm', mediaType: 'audio/webm' },
  ];

  for (const fmt of formats) {
    const filePath = path.join(audioDir, fmt.file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      // Skip files over 25MB (Claude limit)
      if (stats.size > 25 * 1024 * 1024) {
        console.log(`  [analyzer] Audio too large (${(stats.size / 1024 / 1024).toFixed(1)} MB), skipping`);
        return null;
      }
      return {
        base64: fs.readFileSync(filePath).toString('base64'),
        mediaType: fmt.mediaType,
        filename: fmt.file,
        size: stats.size,
      };
    }
  }
  return null;
}

/**
 * Load clicks summary as text.
 */
function loadClicksSummary(sessionDir) {
  const clicksPath = path.join(sessionDir, 'clicks', 'clicks.json');
  if (!fs.existsSync(clicksPath)) {
    // Try root-level clicks.json
    const altPath = path.join(sessionDir, 'clicks.json');
    if (!fs.existsSync(altPath)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(altPath, 'utf-8'));
      return formatClicks(data);
    } catch (_) { return null; }
  }

  try {
    const data = JSON.parse(fs.readFileSync(clicksPath, 'utf-8'));
    return formatClicks(data);
  } catch (_) { return null; }
}

function formatClicks(data) {
  const events = data.events || [];
  if (events.length === 0) return null;

  const lines = events.slice(0, 30).map(e => {
    const text = e.element?.text || '';
    const page = e.page_title || '';
    return `[${e.timestamp || e.index}] Clicked "${text}" on "${page}"`;
  });

  return `Click tracking data (${events.length} total clicks):\n${lines.join('\n')}`;
}

/**
 * Analyze a session — send screenshots + audio to Claude.
 * Returns the text summary.
 */
async function analyzeSession(sessionId) {
  const session = db.getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (!session.local_path) throw new Error(`Session ${sessionId} has no local data — import it first`);

  const sessionDir = session.local_path;
  console.log(`\n  [analyzer] Analyzing session ${sessionId}`);
  console.log(`  [analyzer] Directory: ${sessionDir}`);

  // Load data
  const screenshots = sampleScreenshots(sessionDir);
  const audio = loadAudio(sessionDir);
  const clicksSummary = loadClicksSummary(sessionDir);

  console.log(`  [analyzer] Screenshots: ${screenshots.length}, Audio: ${audio ? `${(audio.size / 1024).toFixed(0)} KB` : 'none'}, Clicks: ${clicksSummary ? 'yes' : 'none'}`);

  if (screenshots.length === 0 && !audio) {
    throw new Error('No screenshots or audio available for analysis');
  }

  // Build message content blocks
  const content = [];

  // Add audio first (if available)
  if (audio) {
    try {
      content.push({
        type: 'text',
        text: 'Here is the audio recording of the demo session conversation:',
      });
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: audio.mediaType,
          data: audio.base64,
        },
      });
    } catch (err) {
      console.log(`  [analyzer] Audio content block failed, will try without: ${err.message}`);
    }
  }

  // Add screenshots
  if (screenshots.length > 0) {
    content.push({
      type: 'text',
      text: `Here are ${screenshots.length} screenshots captured during the demo (sampled from the full session):`,
    });

    for (const ss of screenshots) {
      content.push({
        type: 'text',
        text: `Screenshot at ${ss.timecode}:`,
      });
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: ss.base64,
        },
      });
    }
  }

  // Add clicks summary
  if (clicksSummary) {
    content.push({
      type: 'text',
      text: clicksSummary,
    });
  }

  // Add context from metadata
  const metaContext = [];
  if (session.visitor_name) metaContext.push(`Visitor name (from badge scan): ${session.visitor_name}`);
  if (session.visitor_company) metaContext.push(`Company (from badge scan): ${session.visitor_company}`);
  if (session.se_name) metaContext.push(`Sales Engineer: ${session.se_name}`);

  if (metaContext.length > 0) {
    content.push({ type: 'text', text: 'Session metadata:\n' + metaContext.join('\n') });
  }

  // Add the analysis prompt
  content.push({ type: 'text', text: USER_PROMPT });

  // Call Claude
  console.log(`  [analyzer] Calling Claude (${MODEL})...`);

  let summary;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    summary = response.content[0].text;
    console.log(`  [analyzer] Analysis complete (${summary.length} chars)`);
  } catch (err) {
    // If audio failed (unsupported by proxy), retry without audio
    if (audio && (err.message?.includes('audio') || err.message?.includes('document') || err.status === 400)) {
      console.log(`  [analyzer] Audio not supported by API, retrying with screenshots only...`);
      const contentNoAudio = content.filter(c => c.type !== 'document' && !(c.type === 'text' && c.text?.includes('audio recording')));
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contentNoAudio }],
      });
      summary = response.content[0].text;
      summary += '\n\n[Note: Audio analysis was not available. Summary is based on screenshots and click data only.]';
      console.log(`  [analyzer] Analysis complete without audio (${summary.length} chars)`);
    } else {
      throw err;
    }
  }

  // Save summary
  const summaryPath = path.join(sessionDir, 'summary.txt');
  fs.writeFileSync(summaryPath, summary);
  console.log(`  [analyzer] Saved: ${summaryPath}`);

  // Update session status
  db.upsertSession({ ...session, status: 'analyzed' });

  return summary;
}

module.exports = { analyzeSession };
