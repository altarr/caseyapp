'use strict';
const crypto = require('crypto');
const db = require('./db');

// ── Password Hashing (PBKDF2 — no native deps) ─────────────────────────────

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const attempt = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
}

// ── Session Tokens ──────────────────────────────────────────────────────────
// Simple token-based sessions stored in SQLite. No external deps.

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSessionToken(userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
  db.getDb().prepare(
    'INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, userId, expiresAt);
  return token;
}

function getSessionUser(token) {
  if (!token) return null;
  const row = db.getDb().prepare(`
    SELECT s.user_id, s.expires_at, u.username, u.display_name, u.role, u.must_change_password
    FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token);
  return row || null;
}

function deleteSession(token) {
  db.getDb().prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
}

function cleanExpiredSessions() {
  db.getDb().prepare("DELETE FROM auth_sessions WHERE expires_at <= datetime('now')").run();
}

// ── User CRUD ───────────────────────────────────────────────────────────────

function getUser(id) {
  return db.getDb().prepare('SELECT id, username, display_name, role, must_change_password, created_at FROM users WHERE id = ?').get(id);
}

function getUserByUsername(username) {
  return db.getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function listUsers() {
  return db.getDb().prepare('SELECT id, username, display_name, role, must_change_password, created_at FROM users ORDER BY created_at').all();
}

function createUser({ username, password, display_name, role }) {
  const hashed = hashPassword(password);
  const result = db.getDb().prepare(
    'INSERT INTO users (username, password_hash, display_name, role, must_change_password) VALUES (?, ?, ?, ?, 1)'
  ).run(username, hashed, display_name || username, role || 'user');
  return getUser(result.lastInsertRowid);
}

function updatePassword(userId, newPassword) {
  const hashed = hashPassword(newPassword);
  db.getDb().prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hashed, userId);
}

function updateUser(id, fields) {
  const allowed = ['display_name', 'role'];
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (sets.length === 0) return getUser(id);
  vals.push(id);
  db.getDb().prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getUser(id);
}

function deleteUser(id) {
  db.getDb().prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(id);
  db.getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
}

function resetUserPassword(id, newPassword) {
  const hashed = hashPassword(newPassword);
  db.getDb().prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(hashed, id);
  db.getDb().prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(id);
}

// ── Express Middleware ──────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  // Public routes that don't need auth
  const publicPaths = ['/api/auth/login', '/api/health', '/api/demo-pcs/activate',
    '/api/demo-pcs/register', '/api/sessions/', '/api/events', '/api/badges/scan',
    '/login.html', '/styles.css', '/brand/', '/favicon.ico'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  const token = req.cookies?.phantomrecall_token || req.headers['x-auth-token'];
  const user = getSessionUser(token);

  if (!user) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/login.html');
  }

  // Force password change — only allow password change + logout endpoints
  if (user.must_change_password) {
    const changePaths = ['/api/auth/change-password', '/api/auth/logout',
      '/change-password.html', '/styles.css', '/brand/'];
    if (!changePaths.some(p => req.path.startsWith(p))) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Password change required', must_change_password: true });
      }
      return res.redirect('/change-password.html');
    }
  }

  req.user = user;
  next();
}

// ── Seed Default Admin ──────────────────────────────────────────────────────

function seedDefaultAdmin() {
  const existing = getUserByUsername('admin');
  if (!existing) {
    const hashed = hashPassword('admin');
    db.getDb().prepare(
      "INSERT INTO users (username, password_hash, display_name, role, must_change_password) VALUES ('admin', ?, 'Administrator', 'admin', 1)"
    ).run(hashed);
    console.log('  [auth] Default admin user created (admin/admin, password change required)');
  }
}

module.exports = {
  hashPassword, verifyPassword, generateToken,
  createSessionToken, getSessionUser, deleteSession, cleanExpiredSessions,
  getUser, getUserByUsername, listUsers, createUser, updatePassword,
  updateUser, deleteUser, resetUserPassword,
  authMiddleware, seedDefaultAdmin,
};
