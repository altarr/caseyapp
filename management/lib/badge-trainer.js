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

function imageToBase64(imagePath) {
  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  return { data: buffer.toString('base64'), media_type: mimeTypes[ext] || 'image/jpeg' };
}

async function analyzeBadge(imagePath, existingProfile) {
  const image = imageToBase64(imagePath);

  let systemPrompt = `You are a badge OCR field extraction system. Analyze conference/event badges and extract structured data.

Return ONLY valid JSON with this structure:
{
  "fields": [
    { "value": "extracted text", "field_type": "name|company|title|email|phone|role|event|id|other", "confidence": 0.0-1.0 }
  ],
  "badge_layout": "horizontal|vertical|lanyard|card",
  "event_name": "name if visible or null"
}

Field types:
- name: Person's full name (usually largest text)
- company: Organization/company name
- title: Job title or position
- email: Email address
- phone: Phone number
- role: Event role (Attendee, Speaker, Sponsor, etc.)
- event: Event name
- id: Badge ID or registration number
- other: Any other text`;

  if (existingProfile) {
    const mappings = typeof existingProfile.field_mappings === 'string'
      ? JSON.parse(existingProfile.field_mappings) : existingProfile.field_mappings;
    const corrections = typeof existingProfile.sample_corrections === 'string'
      ? JSON.parse(existingProfile.sample_corrections) : existingProfile.sample_corrections;

    if (mappings.length > 0) {
      systemPrompt += `\n\nThis badge is from ${existingProfile.name}. Known field layout:\n`;
      mappings.forEach((m) => {
        systemPrompt += `- ${m.field_type}: typically at position ${m.position || 'unknown'}\n`;
      });
    }
    if (corrections.length > 0) {
      systemPrompt += `\nPrevious corrections (learn from these):\n`;
      corrections.forEach((c) => {
        systemPrompt += `- "${c.original_value}" was corrected from "${c.original_type}" to "${c.corrected_type}"\n`;
      });
    }
    if (existingProfile.extraction_prompt) {
      systemPrompt += `\n${existingProfile.extraction_prompt}`;
    }
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', ...image } },
        { type: 'text', text: 'Extract all text fields from this conference badge. Return JSON only.' },
      ],
    }],
    system: systemPrompt,
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse badge analysis response');
  return JSON.parse(jsonMatch[0]);
}

function buildExtractionPrompt(fieldMappings, corrections) {
  let prompt = 'Badge field extraction rules:\n';
  if (fieldMappings && fieldMappings.length > 0) {
    fieldMappings.forEach((m) => {
      prompt += `- The ${m.field_type} field is "${m.value}" (position: ${m.position || 'auto'})\n`;
    });
  }
  if (corrections && corrections.length > 0) {
    prompt += '\nLearned corrections:\n';
    corrections.forEach((c) => {
      prompt += `- "${c.original_value}": was ${c.original_type}, should be ${c.corrected_type}\n`;
    });
  }
  return prompt;
}

async function testBadge(imagePath, profileId) {
  const profile = db.getProfile(profileId);
  if (!profile) throw new Error('Profile not found');
  return analyzeBadge(imagePath, profile);
}

module.exports = { analyzeBadge, buildExtractionPrompt, testBadge };
