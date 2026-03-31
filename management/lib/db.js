'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.MANAGEMENT_DB || path.join(__dirname, '..', 'data', 'caseyapp.db');

let db;

function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema();
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      role TEXT DEFAULT 'user',
      must_change_password INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER REFERENCES users(id),
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT,
      location TEXT,
      badge_profile_id INTEGER,
      active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS badge_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER,
      name TEXT NOT NULL,
      field_mappings TEXT DEFAULT '[]',
      extraction_prompt TEXT DEFAULT '',
      sample_images TEXT DEFAULT '[]',
      sample_corrections TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS demo_pcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER,
      name TEXT NOT NULL,
      registered_at TEXT DEFAULT (datetime('now')),
      UNIQUE(event_id, name)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      event_id INTEGER REFERENCES events(id),
      visitor_name TEXT,
      visitor_company TEXT,
      visitor_title TEXT,
      visitor_email TEXT,
      visitor_phone TEXT,
      demo_pc TEXT,
      se_name TEXT,
      status TEXT DEFAULT 'active',
      zip_key TEXT,
      screenshot_count INTEGER DEFAULT 0,
      has_audio INTEGER DEFAULT 0,
      audio_opted_out INTEGER DEFAULT 0,
      local_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      imported_at TEXT
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER REFERENCES events(id),
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      company TEXT,
      title TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      country TEXT,
      lead_score TEXT,
      source TEXT,
      raw_csv_row TEXT,
      imported_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS session_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT REFERENCES sessions(session_id),
      contact_id INTEGER REFERENCES contacts(id),
      match_confidence REAL DEFAULT 0,
      match_method TEXT DEFAULT 'ai',
      match_reasoning TEXT,
      matched_at TEXT DEFAULT (datetime('now')),
      UNIQUE(session_id, contact_id)
    );
  `);
}

// ── Events ──────────────────────────────────────────────────────────────────

function listEvents() {
  return getDb().prepare(`
    SELECT e.*, COUNT(s.id) as session_count
    FROM events e LEFT JOIN sessions s ON s.event_id = e.id
    GROUP BY e.id ORDER BY e.created_at DESC
  `).all();
}

function getEvent(id) {
  return getDb().prepare('SELECT * FROM events WHERE id = ?').get(id);
}

function createEvent({ name, date, location }) {
  const result = getDb().prepare(
    'INSERT INTO events (name, date, location) VALUES (?, ?, ?)'
  ).run(name, date || null, location || null);
  return getEvent(result.lastInsertRowid);
}

function updateEvent(id, fields) {
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (['name', 'date', 'location', 'badge_profile_id', 'active'].includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (sets.length === 0) return getEvent(id);
  vals.push(id);
  getDb().prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getEvent(id);
}

function deleteEvent(id) {
  getDb().prepare('DELETE FROM events WHERE id = ?').run(id);
}

function getActiveEvent() {
  return getDb().prepare('SELECT * FROM events WHERE active = 1 LIMIT 1').get();
}

function setActiveEvent(id) {
  const d = getDb();
  d.prepare('UPDATE events SET active = 0').run();
  d.prepare('UPDATE events SET active = 1 WHERE id = ?').run(id);
  return getEvent(id);
}

// ── Badge Profiles ──────────────────────────────────────────────────────────

function listProfiles(eventId) {
  let q = 'SELECT * FROM badge_profiles';
  const params = [];
  if (eventId) { q += ' WHERE event_id = ?'; params.push(eventId); }
  q += ' ORDER BY created_at DESC';
  return getDb().prepare(q).all(params);
}

function getProfile(id) {
  return getDb().prepare('SELECT * FROM badge_profiles WHERE id = ?').get(id);
}

function createProfile({ event_id, name, field_mappings, extraction_prompt, sample_images, sample_corrections }) {
  const result = getDb().prepare(`
    INSERT INTO badge_profiles (event_id, name, field_mappings, extraction_prompt, sample_images, sample_corrections)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    event_id, name,
    JSON.stringify(field_mappings || []),
    extraction_prompt || '',
    JSON.stringify(sample_images || []),
    JSON.stringify(sample_corrections || [])
  );
  return getProfile(result.lastInsertRowid);
}

function updateProfile(id, fields) {
  const profile = getProfile(id);
  if (!profile) return null;
  const updated = { ...profile, ...fields };
  getDb().prepare(`
    UPDATE badge_profiles SET name=?, field_mappings=?, extraction_prompt=?,
    sample_images=?, sample_corrections=? WHERE id=?
  `).run(
    updated.name,
    typeof updated.field_mappings === 'string' ? updated.field_mappings : JSON.stringify(updated.field_mappings),
    updated.extraction_prompt,
    typeof updated.sample_images === 'string' ? updated.sample_images : JSON.stringify(updated.sample_images),
    typeof updated.sample_corrections === 'string' ? updated.sample_corrections : JSON.stringify(updated.sample_corrections),
    id
  );
  return getProfile(id);
}

// ── Sessions ────────────────────────────────────────────────────────────────

function listSessions(eventId) {
  let q = `SELECT s.*, sc.contact_id, sc.match_confidence, c.email as contact_email,
            c.first_name || ' ' || c.last_name as contact_name
           FROM sessions s
           LEFT JOIN session_contacts sc ON sc.session_id = s.session_id
           LEFT JOIN contacts c ON c.id = sc.contact_id`;
  const params = [];
  if (eventId) { q += ' WHERE s.event_id = ?'; params.push(eventId); }
  q += ' ORDER BY s.imported_at DESC';
  return getDb().prepare(q).all(params);
}

function getSession(sessionId) {
  return getDb().prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
}

function upsertSession(data) {
  getDb().prepare(`
    INSERT INTO sessions (session_id, event_id, visitor_name, visitor_company, visitor_title,
                          visitor_email, visitor_phone, demo_pc, se_name, status,
                          zip_key, screenshot_count, has_audio, audio_opted_out, local_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      event_id=excluded.event_id, visitor_name=excluded.visitor_name,
      visitor_company=excluded.visitor_company, visitor_title=excluded.visitor_title,
      visitor_email=excluded.visitor_email, visitor_phone=excluded.visitor_phone,
      demo_pc=excluded.demo_pc, se_name=excluded.se_name, status=excluded.status,
      zip_key=excluded.zip_key, screenshot_count=excluded.screenshot_count,
      has_audio=excluded.has_audio, audio_opted_out=excluded.audio_opted_out,
      local_path=excluded.local_path
  `).run(
    data.session_id, data.event_id || null, data.visitor_name || 'Unknown',
    data.visitor_company || null, data.visitor_title || null,
    data.visitor_email || null, data.visitor_phone || null,
    data.demo_pc || null, data.se_name || null,
    data.status || 'active',
    data.zip_key || null, data.screenshot_count || 0,
    data.has_audio ? 1 : 0, data.audio_opted_out ? 1 : 0,
    data.local_path || null
  );
  return getSession(data.session_id);
}

// ── Contacts ────────────────────────────────────────────────────────────────

function listContacts(eventId, { search, limit, offset } = {}) {
  let q = 'SELECT * FROM contacts';
  const params = [];
  const where = [];
  if (eventId) { where.push('event_id = ?'); params.push(eventId); }
  if (search) {
    where.push("(first_name || ' ' || last_name LIKE ? OR company LIKE ? OR email LIKE ?)");
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ' ORDER BY last_name, first_name';
  if (limit) { q += ' LIMIT ?'; params.push(limit); }
  if (offset) { q += ' OFFSET ?'; params.push(offset); }
  return getDb().prepare(q).all(params);
}

function getContact(id) {
  return getDb().prepare('SELECT * FROM contacts WHERE id = ?').get(id);
}

function insertContact(data) {
  const result = getDb().prepare(`
    INSERT INTO contacts (event_id, first_name, last_name, email, company, title,
                          phone, address, city, state, zip, country, lead_score, source, raw_csv_row)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.event_id || null, data.first_name || '', data.last_name || '',
    data.email || '', data.company || '', data.title || '',
    data.phone || '', data.address || '', data.city || '',
    data.state || '', data.zip || '', data.country || '',
    data.lead_score || '', data.source || 'csv',
    JSON.stringify(data.raw_csv_row || {})
  );
  return result.lastInsertRowid;
}

function contactCount(eventId) {
  const row = getDb().prepare('SELECT COUNT(*) as count FROM contacts WHERE event_id = ?').get(eventId);
  return row ? row.count : 0;
}

// ── Session-Contact Matching ────────────────────────────────────────────────

function createMatch({ session_id, contact_id, match_confidence, match_method, match_reasoning }) {
  getDb().prepare(`
    INSERT OR REPLACE INTO session_contacts (session_id, contact_id, match_confidence, match_method, match_reasoning)
    VALUES (?, ?, ?, ?, ?)
  `).run(session_id, contact_id, match_confidence || 0, match_method || 'ai', match_reasoning || '');
}

function getMatchesForSession(sessionId) {
  return getDb().prepare(`
    SELECT sc.*, c.first_name, c.last_name, c.email, c.company, c.title
    FROM session_contacts sc JOIN contacts c ON c.id = sc.contact_id
    WHERE sc.session_id = ? ORDER BY sc.match_confidence DESC
  `).all(sessionId);
}

function getMatchesForContact(contactId) {
  return getDb().prepare(`
    SELECT sc.*, s.visitor_name, s.visitor_company, s.session_id
    FROM session_contacts sc JOIN sessions s ON s.session_id = sc.session_id
    WHERE sc.contact_id = ? ORDER BY sc.match_confidence DESC
  `).all(contactId);
}

function unmatchedSessions(eventId) {
  return getDb().prepare(`
    SELECT s.* FROM sessions s
    LEFT JOIN session_contacts sc ON sc.session_id = s.session_id
    WHERE s.event_id = ? AND sc.id IS NULL
  `).all(eventId);
}

// ── Demo PCs ────────────────────────────────────────────────────────────────

function listDemoPcs(eventId) {
  if (eventId) return getDb().prepare('SELECT * FROM demo_pcs WHERE event_id = ?').all(eventId);
  return getDb().prepare('SELECT * FROM demo_pcs').all();
}

function registerDemoPc(eventId, name) {
  getDb().prepare(
    'INSERT OR IGNORE INTO demo_pcs (event_id, name) VALUES (?, ?)'
  ).run(eventId, name);
  return getDb().prepare('SELECT * FROM demo_pcs WHERE event_id = ? AND name = ?').get(eventId, name);
}

function getDemoPc(id) {
  return getDb().prepare('SELECT * FROM demo_pcs WHERE id = ?').get(id);
}

module.exports = {
  getDb, listEvents, getEvent, createEvent, updateEvent, deleteEvent,
  getActiveEvent, setActiveEvent,
  listProfiles, getProfile, createProfile, updateProfile,
  listSessions, getSession, upsertSession,
  listContacts, getContact, insertContact, contactCount,
  createMatch, getMatchesForSession, getMatchesForContact, unmatchedSessions,
  listDemoPcs, registerDemoPc, getDemoPc,
};
