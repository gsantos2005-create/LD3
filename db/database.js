const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'leados.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── CREATE TABLES ────────────────────────────────────────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  team_id INTEGER,
  member_id TEXT
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  UNIQUE(user_id, team_id)
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  team_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  role_title TEXT NOT NULL,
  color TEXT NOT NULL,
  weekly_capacity INTEGER DEFAULT 40
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  team_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  desc TEXT,
  bp INTEGER DEFAULT 3,
  reg TEXT DEFAULT 'Medium',
  status TEXT DEFAULT 'Active',
  color TEXT DEFAULT '#4f8ef7',
  deadline TEXT,
  biz_function TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_stakeholders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  team_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  mid TEXT NOT NULL,
  pid TEXT,
  priority TEXT DEFAULT 'Medium',
  bp INTEGER DEFAULT 3,
  reg TEXT DEFAULT 'Low',
  due TEXT,
  hours REAL DEFAULT 0,
  risk TEXT DEFAULT 'green',
  status TEXT DEFAULT 'Pending',
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS risks (
  id TEXT PRIMARY KEY,
  team_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  pid TEXT,
  owner TEXT,
  severity TEXT DEFAULT 'Medium',
  status TEXT DEFAULT 'Open',
  mitigation TEXT,
  identified TEXT,
  due TEXT,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS member_strengths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS member_growth (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  datetime TEXT NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coaching_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decision_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT
);

CREATE TABLE IF NOT EXISTS team_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  datetime TEXT NOT NULL,
  title TEXT,
  text TEXT NOT NULL,
  attendees TEXT
);

CREATE TABLE IF NOT EXISTS meeting_minutes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  datetime TEXT NOT NULL,
  title TEXT,
  text TEXT NOT NULL,
  attendees TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_title TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
);
`);

// ─── MIGRATIONS ───────────────────────────────────────────────────────────────
try { db.prepare('ALTER TABLE projects ADD COLUMN owner TEXT').run(); } catch {}

function getDb() {
  return db;
}

module.exports = db;
module.exports.getDb = getDb;
