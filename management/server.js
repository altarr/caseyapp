'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./lib/db');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 4000;
const S3_BUCKET = process.env.S3_BUCKET || 'boothapp-sessions-752266476357';

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
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
  res.json({ status: 'ok', service: 'caseyapp-management', version: '1.0.0' });
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

app.get('/api/sessions/:id/screenshots/:filename', (req, res) => {
  const session = db.getSession(req.params.id);
  if (!session || !session.local_path) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(session.local_path, 'screenshots', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Screenshot not found' });
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

// ── Serve badge sample images ───────────────────────────────────────────────
app.use('/badge-samples', express.static(path.join(__dirname, 'data', 'badge-samples')));

// ── Static files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Brand assets ────────────────────────────────────────────────────────────
app.use('/brand', express.static(path.join(__dirname, '..', 'brand')));

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('============================================================');
  console.log('  CaseyApp Management Server');
  console.log(`  http://localhost:${PORT}`);
  console.log(`  S3: ${S3_BUCKET}`);
  console.log('============================================================');
});

module.exports = app;
