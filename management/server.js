'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const db = require('./lib/db');
const auth = require('./lib/auth');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 4000;
const S3_BUCKET = process.env.S3_BUCKET || 'boothapp-sessions-752266476357';

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// ── Auth Routes (before auth middleware) ─────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = auth.getUserByUsername(username);
  if (!user || !auth.verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = auth.createSessionToken(user.id);
  res.cookie('phantomrecall_token', token, {
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({
    user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role },
    must_change_password: !!user.must_change_password,
  });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.phantomrecall_token || req.headers['x-auth-token'];
  if (token) auth.deleteSession(token);
  res.clearCookie('phantomrecall_token');
  res.json({ ok: true });
});

app.post('/api/auth/change-password', (req, res) => {
  const token = req.cookies?.phantomrecall_token || req.headers['x-auth-token'];
  const session = auth.getSessionUser(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  // Verify current password (unless force-changing default)
  if (!session.must_change_password) {
    if (!current_password) return res.status(400).json({ error: 'Current password required' });
    const user = auth.getUserByUsername(session.username);
    if (!auth.verifyPassword(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
  }

  auth.updatePassword(session.user_id, new_password);
  res.json({ ok: true, message: 'Password changed' });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies?.phantomrecall_token || req.headers['x-auth-token'];
  const session = auth.getSessionUser(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  res.json({
    user: { id: session.user_id, username: session.username, display_name: session.display_name, role: session.role },
    must_change_password: !!session.must_change_password,
  });
});

// ── Auth Middleware (protects everything below) ─────────────────────────────
app.use(auth.authMiddleware);

// ── User Management (admin only) ────────────────────────────────────────────

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

app.get('/api/users', requireAdmin, (_, res) => {
  res.json({ users: auth.listUsers() });
});

app.post('/api/users', requireAdmin, (req, res) => {
  const { username, password, display_name, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = auth.getUserByUsername(username);
  if (existing) return res.status(409).json({ error: 'Username already exists' });

  const user = auth.createUser({ username, password, display_name, role: role || 'user' });
  res.json({ user });
});

app.put('/api/users/:id', requireAdmin, (req, res) => {
  const user = auth.updateUser(req.params.id, req.body);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  if (parseInt(req.params.id) === req.user.user_id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  auth.deleteUser(req.params.id);
  res.json({ deleted: true });
});

app.post('/api/users/:id/reset-password', requireAdmin, (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  auth.resetUserPassword(req.params.id, password);
  res.json({ ok: true, message: 'Password reset, user must change on next login' });
});

// ── File Uploads ────────────────────────────────────────────────────────────
const badgeUpload = multer({
  dest: path.join(__dirname, 'data', 'badge-samples'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const csvUpload = multer({
  dest: path.join(__dirname, 'data', 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', service: 'phantomrecall-management', version: '1.0.0' });
});

app.get('/api/config', (_, res) => {
  const activeEvent = db.getActiveEvent();
  res.json({
    s3_bucket: S3_BUCKET,
    active_event: activeEvent || null,
    ai_model: process.env.ANALYSIS_MODEL || 'claude-sonnet-4-6',
  });
});

// ── Events ──────────────────────────────────────────────────────────────────
app.get('/api/events', (_, res) => {
  res.json({ events: db.listEvents() });
});

app.post('/api/events', (req, res) => {
  const { name, date, location } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const event = db.createEvent({ name, date, location });
  res.json({ event });
});

app.get('/api/events/:id', (req, res) => {
  const event = db.getEvent(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json({ event });
});

app.put('/api/events/:id', (req, res) => {
  const event = db.updateEvent(req.params.id, req.body);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json({ event });
});

app.delete('/api/events/:id', (req, res) => {
  db.deleteEvent(req.params.id);
  res.json({ deleted: true });
});

app.post('/api/events/:id/activate', (req, res) => {
  const event = db.setActiveEvent(req.params.id);
  res.json({ event });
});

// ── Badge Training ──────────────────────────────────────────────────────────
app.post('/api/badges/upload', badgeUpload.single('badge'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: req.file.path,
    size: req.file.size,
  });
});

app.post('/api/badges/analyze', badgeUpload.single('badge'), async (req, res) => {
  try {
    const { analyzeBadge } = require('./lib/badge-trainer');
    const imagePath = req.file ? req.file.path : req.body.image_path;
    if (!imagePath) return res.status(400).json({ error: 'No image provided' });

    const profileId = req.body.profile_id;
    const profile = profileId ? db.getProfile(profileId) : null;
    const result = await analyzeBadge(imagePath, profile);
    res.json(result);
  } catch (err) {
    console.error('[badge] analyze error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/badges/train', async (req, res) => {
  try {
    const { event_id, name, field_mappings, sample_images, sample_corrections } = req.body;
    if (!event_id || !name) return res.status(400).json({ error: 'event_id and name required' });

    const { buildExtractionPrompt } = require('./lib/badge-trainer');
    const extraction_prompt = buildExtractionPrompt(field_mappings, sample_corrections);

    const profile = db.createProfile({
      event_id, name, field_mappings, extraction_prompt, sample_images, sample_corrections,
    });
    db.updateEvent(event_id, { badge_profile_id: profile.id });
    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/badges/profiles', (req, res) => {
  res.json({ profiles: db.listProfiles(req.query.event_id) });
});

app.get('/api/badges/profiles/:id', (req, res) => {
  const profile = db.getProfile(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json({ profile });
});

app.post('/api/badges/test', badgeUpload.single('badge'), async (req, res) => {
  try {
    const { testBadge } = require('./lib/badge-trainer');
    const imagePath = req.file ? req.file.path : req.body.image_path;
    const profileId = req.body.profile_id;
    if (!imagePath || !profileId) return res.status(400).json({ error: 'image and profile_id required' });

    const result = await testBadge(imagePath, profileId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sessions ────────────────────────────────────────────────────────────────
app.get('/api/sessions', (req, res) => {
  res.json({ sessions: db.listSessions(req.query.event_id) });
});

app.get('/api/sessions/:id', (req, res) => {
  const session = db.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const matches = db.getMatchesForSession(req.params.id);
  res.json({ session, matches });
});

app.post('/api/sessions/import', async (req, res) => {
  try {
    const { importSession } = require('./lib/session-importer');
    const { session_id, event_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const session = await importSession(session_id, S3_BUCKET, event_id);
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions/import-all', async (req, res) => {
  try {
    const { importAll } = require('./lib/session-importer');
    const event_id = req.body.event_id;
    const results = await importAll(S3_BUCKET, event_id);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id/screenshots', (req, res) => {
  const session = db.getSession(req.params.id);
  if (!session || !session.local_path) return res.json({ files: [] });
  const dir = path.join(session.local_path, 'screenshots');
  if (!fs.existsSync(dir)) return res.json({ files: [] });
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg') || f.endsWith('.png')).sort();
  res.json({ files });
});

app.get('/api/sessions/:id/screenshots/:filename', (req, res) => {
  const session = db.getSession(req.params.id);
  if (!session || !session.local_path) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(session.local_path, 'screenshots', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Screenshot not found' });
  res.sendFile(filePath);
});

app.get('/api/sessions/:id/audio/:filename', (req, res) => {
  const session = db.getSession(req.params.id);
  if (!session || !session.local_path) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(session.local_path, 'audio', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Audio not found' });
  res.sendFile(filePath);
});

// ── Contacts ────────────────────────────────────────────────────────────────
app.get('/api/contacts', (req, res) => {
  const { event_id, search, limit, offset } = req.query;
  const contacts = db.listContacts(event_id, {
    search, limit: parseInt(limit, 10) || 100, offset: parseInt(offset, 10) || 0,
  });
  const count = db.contactCount(event_id);
  res.json({ contacts, total: count });
});

app.get('/api/contacts/:id', (req, res) => {
  const contact = db.getContact(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  const matches = db.getMatchesForContact(req.params.id);
  res.json({ contact, sessions: matches });
});

app.post('/api/contacts/import-csv', csvUpload.single('csv'), async (req, res) => {
  try {
    const { importCsv } = require('./lib/contact-matcher');
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });
    const event_id = req.body.event_id;
    const result = await importCsv(req.file.path, event_id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts/match', async (req, res) => {
  try {
    const { matchSessionsToContacts } = require('./lib/contact-matcher');
    const { event_id } = req.body;
    if (!event_id) return res.status(400).json({ error: 'event_id required' });
    const results = await matchSessionsToContacts(event_id);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/contacts/:id/session', (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });
  db.createMatch({
    session_id,
    contact_id: req.params.id,
    match_confidence: 1.0,
    match_method: 'manual',
    match_reasoning: 'Manually linked by user',
  });
  res.json({ linked: true });
});

// ── Badge Scan (AI extraction using event profile) ──────────────────────────

app.post('/api/badges/scan', badgeUpload.single('badge'), async (req, res) => {
  try {
    const { analyzeBadge } = require('./lib/badge-trainer');
    const imagePath = req.file ? req.file.path : req.body.image_path;
    if (!imagePath) return res.status(400).json({ error: 'No badge image' });

    const eventId = req.body.event_id;
    let profile = null;
    if (eventId) {
      const event = db.getEvent(eventId);
      if (event && event.badge_profile_id) profile = db.getProfile(event.badge_profile_id);
    }

    const result = await analyzeBadge(imagePath, profile);

    // Map extracted fields to a flat object matching the profile's field types
    const fields = {};
    if (result.fields) {
      for (const f of result.fields) {
        if (f.field_type && f.value) fields[f.field_type] = f.value;
      }
    }

    res.json({ fields, raw: result });
  } catch (err) {
    console.error('[badge-scan] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Event Config (full config for clients) ──────────────────────────────────

app.get('/api/events/:id/config', (req, res) => {
  const event = db.getEvent(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  let badge_profile = null;
  let badge_fields = [];
  if (event.badge_profile_id) {
    badge_profile = db.getProfile(event.badge_profile_id);
    if (badge_profile) {
      const mappings = typeof badge_profile.field_mappings === 'string'
        ? JSON.parse(badge_profile.field_mappings) : badge_profile.field_mappings;
      badge_fields = mappings.map(m => ({
        field_type: m.field_type,
        label: m.label || m.field_type,
        required: m.required !== false,
      }));
    }
  }

  const demo_pcs = db.listDemoPcs(event.id);

  res.json({ event, badge_profile, badge_fields, demo_pcs });
});

// ── Demo PC Registration ────────────────────────────────────────────────────

app.get('/api/demo-pcs', (req, res) => {
  res.json({ demo_pcs: db.listDemoPcs(req.query.event_id) });
});

app.post('/api/demo-pcs/register', async (req, res) => {
  const { event_id, demo_pc_name } = req.body;
  if (!event_id || !demo_pc_name) return res.status(400).json({ error: 'event_id and demo_pc_name required' });
  const pc = db.registerDemoPc(event_id, demo_pc_name);

  // Return S3 config + event config so the extension has everything it needs
  const event = db.getEvent(event_id);
  let badgeFields = ['name', 'company'];
  if (event && event.badge_profile_id) {
    const profile = db.getProfile(event.badge_profile_id);
    if (profile) {
      const mappings = typeof profile.field_mappings === 'string'
        ? JSON.parse(profile.field_mappings) : profile.field_mappings;
      badgeFields = mappings.map(m => m.field_type);
    }
  }

  // Get AWS credentials from instance metadata
  let s3Config = { bucket: S3_BUCKET, region: process.env.AWS_REGION || 'us-east-1' };
  try {
    const { fromInstanceMetadata } = require('@aws-sdk/credential-providers');
    const creds = await fromInstanceMetadata({ maxRetries: 2 })();
    s3Config.access_key_id = creds.accessKeyId;
    s3Config.secret_access_key = creds.secretAccessKey;
    s3Config.session_token = creds.sessionToken || '';
  } catch (_) {
    s3Config.access_key_id = process.env.AWS_ACCESS_KEY_ID || '';
    s3Config.secret_access_key = process.env.AWS_SECRET_ACCESS_KEY || '';
  }

  res.json({
    demo_pc: pc,
    event: event,
    badge_fields: badgeFields,
    management_url: process.env.MANAGEMENT_URL || `${req.protocol}://${req.get('host')}`,
    s3_config: s3Config,
  });
});

// Generate a pairing code for a demo PC to register with
app.post('/api/demo-pcs/pairing-code', requireAdmin, (req, res) => {
  const { event_id, demo_pc_name } = req.body;
  if (!event_id || !demo_pc_name) return res.status(400).json({ error: 'event_id and demo_pc_name required' });

  // 6-char uppercase code, valid 1 hour
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // Store in DB
  db.getDb().prepare(`
    CREATE TABLE IF NOT EXISTS pairing_codes (
      code TEXT PRIMARY KEY, event_id INTEGER, demo_pc_name TEXT,
      expires_at TEXT, used INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  db.getDb().prepare(
    'INSERT OR REPLACE INTO pairing_codes (code, event_id, demo_pc_name, expires_at) VALUES (?, ?, ?, ?)'
  ).run(code, event_id, demo_pc_name, expiresAt);

  res.json({ code, expires_at: expiresAt, demo_pc_name, event_id });
});

// Demo PC calls this with the pairing code to register and get AWS credentials
app.post('/api/demo-pcs/activate', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Pairing code required' });

  db.getDb().prepare(`
    CREATE TABLE IF NOT EXISTS pairing_codes (
      code TEXT PRIMARY KEY, event_id INTEGER, demo_pc_name TEXT,
      expires_at TEXT, used INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const pairing = db.getDb().prepare(
    "SELECT * FROM pairing_codes WHERE code = ? AND used = 0 AND expires_at > datetime('now')"
  ).get(code.toUpperCase());

  if (!pairing) return res.status(404).json({ error: 'Invalid or expired pairing code' });

  // Mark as used
  db.getDb().prepare('UPDATE pairing_codes SET used = 1 WHERE code = ?').run(pairing.code);

  // Register demo PC
  const pc = db.registerDemoPc(pairing.event_id, pairing.demo_pc_name);

  // Get event config
  const event = db.getEvent(pairing.event_id);
  let badgeFields = ['name', 'company'];
  if (event && event.badge_profile_id) {
    const profile = db.getProfile(event.badge_profile_id);
    if (profile) {
      const mappings = typeof profile.field_mappings === 'string'
        ? JSON.parse(profile.field_mappings) : profile.field_mappings;
      badgeFields = mappings.map(m => m.field_type);
    }
  }

  // Get AWS credentials for the demo PC
  // Try STS AssumeRole for temporary creds, fall back to instance metadata or env vars
  let s3Config = { bucket: S3_BUCKET, region: process.env.AWS_REGION || 'us-east-1' };
  try {
    const { fromInstanceMetadata } = require('@aws-sdk/credential-providers');
    const provider = fromInstanceMetadata({ maxRetries: 2 });
    const creds = await provider();
    s3Config.access_key_id = creds.accessKeyId;
    s3Config.secret_access_key = creds.secretAccessKey;
    s3Config.session_token = creds.sessionToken || '';
    s3Config.expires = creds.expiration ? creds.expiration.toISOString() : '';
    console.log('[pairing] Using instance metadata credentials');
  } catch (err) {
    console.log('[pairing] Instance metadata unavailable, using env vars:', err.message);
    s3Config.access_key_id = process.env.AWS_ACCESS_KEY_ID || '';
    s3Config.secret_access_key = process.env.AWS_SECRET_ACCESS_KEY || '';
  }

  res.json({
    activated: true,
    demo_pc: pc,
    event: event,
    badge_fields: badgeFields,
    management_url: process.env.MANAGEMENT_URL || `${req.protocol}://${req.get('host')}`,
    s3_config: s3Config,
  });
});

app.get('/api/demo-pcs/:id/qr-payload', (req, res) => {
  const pc = db.getDemoPc(req.params.id);
  if (!pc) return res.status(404).json({ error: 'Demo PC not found' });

  const event = db.getEvent(pc.event_id);
  let badgeFields = ['name', 'company'];
  if (event && event.badge_profile_id) {
    const profile = db.getProfile(event.badge_profile_id);
    if (profile) {
      const mappings = typeof profile.field_mappings === 'string'
        ? JSON.parse(profile.field_mappings) : profile.field_mappings;
      badgeFields = mappings.map(m => m.field_type);
    }
  }

  const baseUrl = process.env.MANAGEMENT_URL || `${req.protocol}://${req.get('host')}`;

  res.json({
    type: 'phantomrecall-pair',
    v: 2,
    managementUrl: baseUrl,
    eventId: pc.event_id,
    demoPcId: pc.name,
    demoPcDbId: pc.id,
    badgeFields,
    eventName: event ? event.name : null,
  });
});

// ── Session Lifecycle (control plane) ───────────────────────────────────────

const { S3Client: MgmtS3Client, PutObjectCommand: MgmtPutCmd, DeleteObjectCommand: MgmtDelCmd, GetObjectCommand: MgmtGetCmd } = require('@aws-sdk/client-s3');
const mgmtS3 = new MgmtS3Client({ region: process.env.AWS_REGION || 'us-east-1' });

async function s3Put(key, body) {
  await mgmtS3.send(new MgmtPutCmd({
    Bucket: S3_BUCKET, Key: key,
    Body: JSON.stringify(body, null, 2),
    ContentType: 'application/json',
  }));
}

async function s3Del(key) {
  await mgmtS3.send(new MgmtDelCmd({ Bucket: S3_BUCKET, Key: key }));
}

async function s3Get(key) {
  try {
    const resp = await mgmtS3.send(new MgmtGetCmd({ Bucket: S3_BUCKET, Key: key }));
    return JSON.parse(await resp.Body.transformToString());
  } catch (_) { return null; }
}

function genSessionId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

app.post('/api/sessions/create', async (req, res) => {
  try {
    const { event_id, visitor_name, visitor_company, visitor_title,
            visitor_email, visitor_phone, demo_pc, se_name } = req.body;
    if (!visitor_name) return res.status(400).json({ error: 'visitor_name required' });

    const pc = demo_pc || 'booth-pc-1';
    const session_id = genSessionId();
    const now = new Date().toISOString();

    const metadata = {
      session_id, visitor_name,
      visitor_company: visitor_company || null,
      visitor_title: visitor_title || null,
      visitor_email: visitor_email || null,
      visitor_phone: visitor_phone || null,
      badge_photo: null,
      started_at: now, ended_at: null,
      demo_pc: pc, se_name: se_name || null,
      event_id: event_id || null,
      audio_consent: true, status: 'active',
    };

    await Promise.all([
      s3Put(`sessions/${session_id}/metadata.json`, metadata),
      s3Put(`sessions/${session_id}/state.json`, {
        session_id, current_state: 'active', updated_at: now,
        history: [{ from: null, to: 'active', at: now }],
      }),
      s3Put(`commands/${pc}/start.json`, { session_id, demo_pc: pc, started_at: now }),
      s3Put('active-session.json', {
        session_id, active: true, started_at: now,
        visitor_name, stop_audio: false,
      }),
    ]);

    // Store in management DB
    db.upsertSession({
      session_id, event_id: event_id || null,
      visitor_name, visitor_company, visitor_title,
      visitor_email, visitor_phone, demo_pc: pc, se_name,
      status: 'active',
    });

    // Auto-create contact from badge scan data
    const nameParts = (visitor_name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    if (firstName) {
      const contactId = db.insertContact({
        event_id: event_id || null,
        first_name: firstName,
        last_name: lastName,
        email: visitor_email || '',
        company: visitor_company || '',
        title: visitor_title || '',
        phone: visitor_phone || '',
        source: 'badge-scan',
      });
      // Auto-link session to contact
      db.createMatch({
        session_id, contact_id: contactId,
        match_confidence: 1.0,
        match_method: 'badge-scan',
        match_reasoning: 'Automatically linked from badge scan',
      });
    }

    console.log(`[session] created ${session_id} for ${visitor_name} (event ${event_id})`);
    res.json({ session_id, metadata });
  } catch (err) {
    console.error('[session] create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions/:id/end', async (req, res) => {
  try {
    const session_id = req.params.id;
    const now = new Date().toISOString();
    const session = db.getSession(session_id);
    const pc = req.body.demo_pc || session?.demo_pc || 'booth-pc-1';

    // Read existing metadata to preserve fields
    const existing = await s3Get(`sessions/${session_id}/metadata.json`) || {};

    await Promise.all([
      s3Put(`sessions/${session_id}/metadata.json`, {
        ...existing, ended_at: now, status: 'completed', upload_complete: true,
      }),
      s3Put(`commands/${pc}/end.json`, { session_id, demo_pc: pc, ended_at: now }),
      s3Del('active-session.json'),
    ]);

    if (session) db.upsertSession({ ...session, status: 'completed' });

    res.json({ session_id, status: 'completed', ended_at: now });

    // Auto-import and analyze after a delay (wait for packager + phone audio upload)
    setTimeout(async () => {
      try {
        console.log(`[auto-analyze] Waiting for session ${session_id} data...`);
        // Wait for zip to appear in S3 (packager uploads after session ends)
        const { importSession } = require('./lib/session-importer');
        const { analyzeSession } = require('./lib/session-analyzer');

        // Retry import up to 6 times (30 seconds total)
        let imported = null;
        for (let i = 0; i < 6; i++) {
          try {
            // Delete existing DB entry so re-import picks up fresh data
            db.getDb().prepare('DELETE FROM sessions WHERE session_id = ?').run(session_id);
            imported = await importSession(session_id, S3_BUCKET, null);
            if (imported && imported.screenshot_count > 0) break;
          } catch (_) {}
          await new Promise(r => setTimeout(r, 5000));
        }

        if (!imported || imported.screenshot_count === 0) {
          console.log(`[auto-analyze] No screenshots found for ${session_id}, skipping analysis`);
          return;
        }

        console.log(`[auto-analyze] Imported ${session_id}: ${imported.screenshot_count} screenshots, audio: ${imported.has_audio}`);
        const summary = await analyzeSession(session_id);
        await s3Put(`sessions/${session_id}/output/summary.txt`, summary);
        console.log(`[auto-analyze] Session ${session_id} analyzed and summary uploaded`);
      } catch (err) {
        console.error(`[auto-analyze] Failed for ${session_id}: ${err.message}`);
      }
    }, 15000); // 15 second delay for uploads to finish

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions/:id/stop-audio', async (req, res) => {
  try {
    const session_id = req.params.id;
    const now = new Date().toISOString();

    await s3Put(`sessions/${session_id}/commands/stop-audio`, {
      session_id, stopped_at: now,
    });
    await s3Put('active-session.json', {
      session_id, active: true, stop_audio: true,
    });

    res.json({ session_id, audio_stopped: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Audio upload from phone
const audioUpload = multer({
  dest: path.join(__dirname, 'data', 'audio-uploads'),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

app.post('/api/sessions/:id/audio', audioUpload.single('audio'), async (req, res) => {
  try {
    const session_id = req.params.id;
    if (!req.file) return res.status(400).json({ error: 'No audio file' });

    // Upload to S3
    const fs = require('fs');
    const audioData = fs.readFileSync(req.file.path);
    const ext = req.file.originalname?.split('.').pop() || 'm4a';
    const s3Key = `sessions/${session_id}/audio/recording.${ext}`;

    await mgmtS3.send(new MgmtPutCmd({
      Bucket: S3_BUCKET, Key: s3Key,
      Body: audioData,
      ContentType: req.file.mimetype || 'audio/mp4',
    }));

    // Cleanup temp file
    try { fs.unlinkSync(req.file.path); } catch (_) {}

    console.log(`[audio] Uploaded ${s3Key} (${(audioData.length / 1024 / 1024).toFixed(1)} MB)`);
    res.json({ ok: true, key: s3Key, size: audioData.length });
  } catch (err) {
    console.error('[audio] Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Clear all sessions (S3 + DB)
app.post('/api/sessions/clear-all', async (req, res) => {
  try {
    const { S3Client: ClearS3, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
    const clearS3 = new ClearS3({ region: process.env.AWS_REGION || 'us-east-1' });

    // Delete all S3 session objects
    let deleted = 0;
    let continuationToken;
    do {
      const list = await clearS3.send(new ListObjectsV2Command({
        Bucket: S3_BUCKET, Prefix: 'sessions/',
        ContinuationToken: continuationToken,
      }));
      if (list.Contents && list.Contents.length > 0) {
        await clearS3.send(new DeleteObjectsCommand({
          Bucket: S3_BUCKET,
          Delete: { Objects: list.Contents.map(o => ({ Key: o.Key })) },
        }));
        deleted += list.Contents.length;
      }
      continuationToken = list.NextContinuationToken;
    } while (continuationToken);

    // Also delete active-session.json and commands
    try { await s3Del('active-session.json'); } catch (_) {}
    try {
      const cmdList = await clearS3.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: 'commands/' }));
      if (cmdList.Contents && cmdList.Contents.length > 0) {
        await clearS3.send(new DeleteObjectsCommand({
          Bucket: S3_BUCKET,
          Delete: { Objects: cmdList.Contents.map(o => ({ Key: o.Key })) },
        }));
        deleted += cmdList.Contents.length;
      }
    } catch (_) {}

    // Clear DB sessions
    db.getDb().prepare('DELETE FROM session_contacts').run();
    db.getDb().prepare('DELETE FROM sessions').run();

    console.log(`[sessions] Cleared ${deleted} S3 objects + DB sessions`);
    res.json({ ok: true, deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export all sessions as CSV with contact info + summaries
app.get('/api/sessions/export-csv', (req, res) => {
  const sessions = db.listSessions();
  const rows = [['Name', 'Title', 'Company', 'Email', 'Phone', 'Session ID', 'Screenshots', 'Audio', 'Visit Summary', 'Key Findings'].join(',')];

  for (const s of sessions) {
    // Get matched contact
    const matches = db.getMatchesForSession(s.session_id);
    const contact = matches.length > 0 ? db.getContact(matches[0].contact_id) : null;

    // Load summary
    let visitSummary = '';
    let keyFindings = '';
    if (s.local_path) {
      const sumPath = path.join(s.local_path, 'summary.txt');
      if (fs.existsSync(sumPath)) {
        const txt = fs.readFileSync(sumPath, 'utf-8');
        // Extract sections
        const demoMatch = txt.match(/DEMO SUMMARY:\n([\s\S]*?)(?=\n\n[A-Z])/);
        const convMatch = txt.match(/CONVERSATION SUMMARY:\n([\s\S]*?)(?=\n\n[A-Z])/);
        const interestMatch = txt.match(/KEY INTERESTS:\n([\s\S]*?)(?=\n\n[A-Z])/);
        const followMatch = txt.match(/RECOMMENDED FOLLOW-UP:\n([\s\S]*?)(?=$|\n\n\[)/);

        visitSummary = [(demoMatch?.[1] || '').trim(), (convMatch?.[1] || '').trim()].filter(Boolean).join(' | ');
        keyFindings = [(interestMatch?.[1] || '').trim(), (followMatch?.[1] || '').trim()].filter(Boolean).join(' | ');
      }
    }

    const esc = (v) => '"' + (v || '').replace(/"/g, '""').replace(/\n/g, ' ') + '"';

    rows.push([
      esc(contact ? `${contact.first_name} ${contact.last_name}` : s.visitor_name),
      esc(contact?.title || s.visitor_title || ''),
      esc(contact?.company || s.visitor_company || ''),
      esc(contact?.email || s.visitor_email || ''),
      esc(contact?.phone || s.visitor_phone || ''),
      esc(s.session_id),
      s.screenshot_count || 0,
      s.has_audio ? 'Yes' : 'No',
      esc(visitSummary),
      esc(keyFindings),
    ].join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="phantom-recall-sessions-export.csv"');
  res.send(rows.join('\n'));
});

// Delete a single session (S3 + DB + local files)
app.delete('/api/sessions/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const session = db.getSession(sessionId);

    // Delete from S3
    const { S3Client: DelS3, ListObjectsV2Command: DelList, DeleteObjectsCommand: DelObjs } = require('@aws-sdk/client-s3');
    const delS3 = new DelS3({ region: process.env.AWS_REGION || 'us-east-1' });
    let continuationToken;
    do {
      const list = await delS3.send(new DelList({
        Bucket: S3_BUCKET, Prefix: `sessions/${sessionId}/`,
        ContinuationToken: continuationToken,
      }));
      if (list.Contents && list.Contents.length > 0) {
        await delS3.send(new DelObjs({
          Bucket: S3_BUCKET,
          Delete: { Objects: list.Contents.map(o => ({ Key: o.Key })) },
        }));
      }
      continuationToken = list.NextContinuationToken;
    } while (continuationToken);

    // Delete local files
    if (session && session.local_path) {
      try { fs.rmSync(session.local_path, { recursive: true, force: true }); } catch (_) {}
    }

    // Delete from DB
    db.getDb().prepare('DELETE FROM session_contacts WHERE session_id = ?').run(sessionId);
    db.getDb().prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);

    console.log(`[session] Deleted ${sessionId}`);
    res.json({ ok: true, deleted: sessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate fake sessions for contacts that don't have one
app.post('/api/sessions/generate-fake', async (req, res) => {
  try {
    const { count, event_id } = req.body;
    const limit = Math.min(count || 20, 100);
    const eid = event_id || 1;

    // Get contacts without sessions
    const unmatched = db.getDb().prepare(`
      SELECT c.* FROM contacts c
      LEFT JOIN session_contacts sc ON sc.contact_id = c.id
      WHERE sc.id IS NULL AND c.source = 'csv'
      LIMIT ?
    `).all(limit);

    const products = [
      'Vision One XDR', 'Endpoint Security', 'Cloud Security', 'Email Security',
      'Network Security', 'Attack Surface Management', 'Zero Trust', 'TippingPoint IPS',
    ];
    const interests = [
      'Consolidating security tools', 'Reducing alert fatigue', 'Cloud migration security',
      'Ransomware protection', 'SOC automation', 'Compliance reporting', 'Incident response',
      'Threat intelligence', 'Zero day protection', 'BYOD security policies',
    ];

    const created = [];
    for (const contact of unmatched) {
      const sid = genSessionId();
      const prodShown = products.sort(() => Math.random() - 0.5).slice(0, 3);
      const visitorInterests = interests.sort(() => Math.random() - 0.5).slice(0, 2);
      const score = Math.floor(Math.random() * 5) + 5; // 5-9

      const summary = `VISITOR: ${contact.first_name} ${contact.last_name}
COMPANY: ${contact.company || 'Unknown'}
ROLE: ${contact.title || 'Not mentioned'}

DEMO SUMMARY:
The SE demonstrated ${prodShown.join(', ')} during a ${Math.floor(Math.random() * 10) + 5}-minute session. Key features shown included the unified dashboard, automated threat detection, and policy management capabilities.

CONVERSATION SUMMARY:
The visitor expressed interest in ${visitorInterests[0].toLowerCase()} and asked detailed questions about ${visitorInterests[1].toLowerCase()}. They mentioned currently using a multi-vendor approach and looking to consolidate. The SE highlighted how Vision One addresses these needs with a single platform.

KEY INTERESTS:
- ${visitorInterests[0]}: Strong interest based on multiple follow-up questions
- ${visitorInterests[1]}: Asked about specific implementation details

RECOMMENDED FOLLOW-UP:
- Send product documentation for ${prodShown[0]}
- Schedule a deeper technical demo focusing on ${visitorInterests[0].toLowerCase()}
- Connect with SE for a POC discussion`;

      // Create session in DB
      db.upsertSession({
        session_id: sid, event_id: eid,
        visitor_name: `${contact.first_name} ${contact.last_name}`,
        visitor_company: contact.company,
        visitor_title: contact.title,
        visitor_email: contact.email,
        status: 'analyzed',
        screenshot_count: Math.floor(Math.random() * 200) + 50,
        has_audio: true,
        local_path: null,
      });

      // Save fake summary
      const sessionDir = path.join(__dirname, 'data', 'sessions', sid);
      fs.mkdirSync(sessionDir, { recursive: true });
      fs.writeFileSync(path.join(sessionDir, 'summary.txt'), summary);
      db.upsertSession({ session_id: sid, local_path: sessionDir, status: 'analyzed' });

      // Link to contact
      db.createMatch({
        session_id: sid, contact_id: contact.id,
        match_confidence: 1.0,
        match_method: 'generated',
        match_reasoning: 'Auto-generated demo session',
      });

      created.push({ session_id: sid, contact: `${contact.first_name} ${contact.last_name}` });
    }

    res.json({ created: created.length, sessions: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Session analysis
app.post('/api/sessions/:id/analyze', async (req, res) => {
  const sessionId = req.params.id;
  const session = db.getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.json({ ok: true, analyzing: true, session_id: sessionId });

  // Run analysis async (don't block the response)
  const { analyzeSession } = require('./lib/session-analyzer');
  analyzeSession(sessionId).then(summary => {
    // Upload summary to S3
    s3Put(`sessions/${sessionId}/output/summary.txt`, summary).catch(() => {});
    console.log(`[analyze] Session ${sessionId} analysis complete`);
  }).catch(err => {
    console.error(`[analyze] Session ${sessionId} failed: ${err.message}`);
  });
});

app.get('/api/sessions/:id/summary', (req, res) => {
  const session = db.getSession(req.params.id);
  if (!session || !session.local_path) return res.status(404).json({ error: 'Session not found' });

  const summaryPath = path.join(session.local_path, 'summary.txt');
  if (!fs.existsSync(summaryPath)) {
    return res.status(404).json({ error: 'Not yet analyzed', status: session.status });
  }

  const summary = fs.readFileSync(summaryPath, 'utf-8');
  res.json({ session_id: req.params.id, summary, status: 'analyzed' });
});

// Active session polling (for extension)
app.get('/api/sessions/active', async (req, res) => {
  try {
    const data = await s3Get('active-session.json');
    if (!data) return res.json({ active: false });
    res.json(data);
  } catch (_) {
    res.json({ active: false });
  }
});

// ── Serve badge sample images ───────────────────────────────────────────────
app.use('/badge-samples', express.static(path.join(__dirname, 'data', 'badge-samples')));

// ── Static files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Brand assets ────────────────────────────────────────────────────────────
app.use('/brand', express.static(path.join(__dirname, '..', 'brand')));

// ── Start ───────────────────────────────────────────────────────────────────
auth.seedDefaultAdmin();
// Clean expired sessions every hour
setInterval(() => auth.cleanExpiredSessions(), 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log('============================================================');
  console.log('  Phantom Recall Management Server');
  console.log(`  http://localhost:${PORT}`);
  console.log(`  S3: ${S3_BUCKET}`);
  console.log('============================================================');
});

module.exports = app;
