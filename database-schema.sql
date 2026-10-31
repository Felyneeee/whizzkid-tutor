-- Whizzkids standalone SQLite account database.
-- Open whizzkids.db in SQLite Browser Lite, or run this script in a new SQLite database.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'tutor', 'tutee')),
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO users (id, role, email, username, password, created_at)
VALUES ('u_admin', 'admin', 'admin@whizzkids.ph', 'admin', 'admin123', '2026-10-26T00:00:00.000Z');
