// Accounts and sessions (FR-01). Passwords: scrypt + per-user salt.
// Sessions: random token in an HttpOnly cookie; only its SHA-256 hash is stored.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { IncomingMessage } from 'node:http';

export const COOKIE = 'vg_session';
const SESSION_DAYS = 30;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export interface User { id: number; email: string; name: string }

export function migrate(db: DatabaseSync): void {
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at INTEGER NOT NULL
  )`);
  // Who can manage which station. Roles leave room for presenters (FR-14).
  db.exec(`CREATE TABLE IF NOT EXISTS station_members (
    station_id INTEGER NOT NULL REFERENCES stations(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK (role IN ('owner', 'presenter')),
    PRIMARY KEY (station_id, user_id)
  )`);
}

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(pw, salt, 64).toString('hex')}`;
}

function checkPassword(pw: string, stored: string): boolean {
  const [, salt, hash] = stored.split('$');
  const want = Buffer.from(hash, 'hex');
  const got = scryptSync(pw, Buffer.from(salt, 'hex'), want.length);
  return timingSafeEqual(want, got);
}

// Same work whether or not the email exists, so timing doesn't reveal accounts.
const DUMMY_HASH = hashPassword(randomBytes(12).toString('hex'));

export function validateSignup(email: unknown, name: unknown, password: unknown): string | null {
  if (typeof email !== 'string' || !EMAIL.test(email.trim())) return 'Enter a valid email address';
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) return 'Enter your name (max 80 characters)';
  if (typeof password !== 'string' || password.length < 10 || password.length > 200) return 'Password must be at least 10 characters';
  return null;
}

export function createUser(db: DatabaseSync, email: string, name: string, password: string): User | null {
  try {
    const r = db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
      .run(email.trim().toLowerCase(), name.trim(), hashPassword(password));
    return { id: Number(r.lastInsertRowid), email: email.trim().toLowerCase(), name: name.trim() };
  } catch {
    return null; // email taken
  }
}

export function verifyLogin(db: DatabaseSync, email: unknown, password: unknown): User | null {
  if (typeof email !== 'string' || typeof password !== 'string') return null;
  const row = db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as (User & { password_hash: string }) | undefined;
  const ok = checkPassword(password, row?.password_hash ?? DUMMY_HASH);
  return row && ok ? { id: row.id, email: row.email, name: row.name } : null;
}

export function startSession(db: DatabaseSync, userId: number): string {
  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(token), userId, Date.now() + SESSION_DAYS * 86_400_000);
  return token;
}

export function endSession(db: DatabaseSync, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86_400}${secure ? '; Secure' : ''}`;
}

export const clearCookie = `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;

export function readToken(req: IncomingMessage): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === COOKIE && v) return v;
  }
  return null;
}

export function currentUser(db: DatabaseSync, req: IncomingMessage): User | null {
  const token = readToken(req);
  if (!token) return null;
  const row = db.prepare(
    'SELECT u.id, u.email, u.name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?',
  ).get(hashToken(token)) as (User & { expires_at: number }) | undefined;
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    endSession(db, token);
    return null;
  }
  return { id: row.id, email: row.email, name: row.name };
}

// Simple in-memory brake on password guessing: 10 failures per key per 15 minutes.
const failures = new Map<string, { n: number; until: number }>();
export function tooManyAttempts(key: string): boolean {
  const f = failures.get(key);
  return !!f && f.until > Date.now() && f.n >= 10;
}
export function recordFailure(key: string): void {
  const f = failures.get(key);
  if (!f || f.until < Date.now()) failures.set(key, { n: 1, until: Date.now() + 15 * 60_000 });
  else f.n++;
}
export function clearFailures(key: string): void {
  failures.delete(key);
}
