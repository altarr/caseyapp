'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
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

// ── CSV Import ──────────────────────────────────────────────────────────────

// Common header name variations mapped to DB field names
const HEADER_MAP = {
  'first name': 'first_name', 'firstname': 'first_name', 'first': 'first_name', 'fname': 'first_name',
  'last name': 'last_name', 'lastname': 'last_name', 'last': 'last_name', 'lname': 'last_name',
  'name': '_full_name',
  'email': 'email', 'email address': 'email', 'e-mail': 'email',
  'company': 'company', 'organization': 'company', 'org': 'company', 'company name': 'company',
  'title': 'title', 'job title': 'title', 'position': 'title', 'role': 'title',
  'phone': 'phone', 'phone number': 'phone', 'telephone': 'phone', 'mobile': 'phone',
  'address': 'address', 'street': 'address', 'address 1': 'address', 'street address': 'address',
  'city': 'city', 'town': 'city',
  'state': 'state', 'province': 'state', 'region': 'state',
  'zip': 'zip', 'postal code': 'zip', 'zipcode': 'zip', 'zip code': 'zip', 'postcode': 'zip',
  'country': 'country', 'nation': 'country',
  'lead score': 'lead_score', 'score': 'lead_score', 'rating': 'lead_score',
  'source': 'source', 'lead source': 'source', 'campaign': 'source',
};

function detectColumnMapping(headers) {
  const mapping = {};
  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    if (HEADER_MAP[normalized]) {
      mapping[header] = HEADER_MAP[normalized];
    }
  }
  return mapping;
}

async function importCsv(filePath, eventId) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Remove BOM if present
  const clean = content.replace(/^\uFEFF/, '');

  const records = parse(clean, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  if (records.length === 0) return { imported: 0, columns: [] };

  const headers = Object.keys(records[0]);
  const mapping = detectColumnMapping(headers);

  let imported = 0;
  for (const row of records) {
    const contact = { event_id: eventId, raw_csv_row: row };

    for (const [csvCol, dbField] of Object.entries(mapping)) {
      if (dbField === '_full_name') {
        // Split "First Last" into first_name + last_name
        const parts = (row[csvCol] || '').trim().split(/\s+/);
        contact.first_name = parts[0] || '';
        contact.last_name = parts.slice(1).join(' ') || '';
      } else {
        contact[dbField] = row[csvCol] || '';
      }
    }

    db.insertContact(contact);
    imported++;
  }

  return {
    imported,
    total_rows: records.length,
    columns: headers,
    mapping,
    detected_fields: Object.values(mapping),
  };
}

// ── AI Contact Matching ─────────────────────────────────────────────────────

async function matchSessionsToContacts(eventId) {
  const unmatched = db.unmatchedSessions(eventId);
  const allContacts = db.listContacts(eventId, { limit: 5000 });

  if (unmatched.length === 0) return { matched: 0, message: 'No unmatched sessions' };
  if (allContacts.length === 0) return { matched: 0, message: 'No contacts imported' };

  const results = { matched: 0, failed: 0, matches: [] };

  // Build contact list string (batch in groups of 50)
  const BATCH_SIZE = 50;

  for (const session of unmatched) {
    let bestMatch = null;

    for (let i = 0; i < allContacts.length; i += BATCH_SIZE) {
      const batch = allContacts.slice(i, i + BATCH_SIZE);
      const contactList = batch.map((c, idx) => {
        const globalIdx = i + idx;
        return `${globalIdx}. ${c.first_name} ${c.last_name} | ${c.email} | ${c.company} | ${c.title}`;
      }).join('\n');

      try {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 256,
          system: `You are a contact matching system. Match demo session visitors to contacts from an event attendee list. Consider name variations (nicknames, abbreviations, middle names), company name variations (Inc, Corp, Ltd), and typos from OCR. Return ONLY valid JSON.`,
          messages: [{
            role: 'user',
            content: `Demo session visitor:
  Name: "${session.visitor_name}"
  Company: "${session.visitor_company || 'unknown'}"

Contact list (index | name | email | company | title):
${contactList}

Find the best match. Return:
{"match_index": <number or null>, "confidence": <0.0-1.0>, "reasoning": "<brief explanation>"}

If no good match (confidence < 0.5), return {"match_index": null, "confidence": 0, "reasoning": "No match found"}`,
          }],
        });

        const text = response.content[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          if (result.match_index !== null && result.confidence > 0.5) {
            if (!bestMatch || result.confidence > bestMatch.confidence) {
              bestMatch = {
                contact: allContacts[result.match_index],
                confidence: result.confidence,
                reasoning: result.reasoning,
              };
            }
          }
        }
      } catch (err) {
        console.error(`  [match] AI error for session ${session.session_id}: ${err.message}`);
      }
    }

    if (bestMatch) {
      db.createMatch({
        session_id: session.session_id,
        contact_id: bestMatch.contact.id,
        match_confidence: bestMatch.confidence,
        match_method: 'ai',
        match_reasoning: bestMatch.reasoning,
      });
      results.matched++;
      results.matches.push({
        session_id: session.session_id,
        visitor_name: session.visitor_name,
        contact_name: `${bestMatch.contact.first_name} ${bestMatch.contact.last_name}`,
        contact_email: bestMatch.contact.email,
        confidence: bestMatch.confidence,
        reasoning: bestMatch.reasoning,
      });
    } else {
      results.failed++;
    }
  }

  return results;
}

module.exports = { importCsv, matchSessionsToContacts, detectColumnMapping };
