-- V6 additive migration. No DROP, ALTER or writes to any V3/V4/V5 store.
CREATE TABLE IF NOT EXISTS intel_settings (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS intel_authors (id TEXT PRIMARY KEY, platform TEXT NOT NULL, body TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS intel_works (id TEXT PRIMARY KEY, platform TEXT NOT NULL, author_id TEXT, published TEXT, fetched_at TEXT NOT NULL, expires_at TEXT NOT NULL, body TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS intel_works_author ON intel_works(platform,author_id,published);
CREATE INDEX IF NOT EXISTS intel_works_expires ON intel_works(expires_at);
CREATE TABLE IF NOT EXISTS intel_cache (id TEXT PRIMARY KEY, expires_at TEXT NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS intel_usage (day TEXT NOT NULL, provider TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, successes INTEGER NOT NULL DEFAULT 0, credits REAL, PRIMARY KEY(day,provider));
CREATE TABLE IF NOT EXISTS intel_logs (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, platform TEXT NOT NULL, operation TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS intel_jobs (id TEXT PRIMARY KEY, platform TEXT NOT NULL, work_id TEXT NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS intel_topics (id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS intel_reports (day TEXT PRIMARY KEY, body TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS intel_runs (id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS intel_daily_works (day TEXT NOT NULL, work_id TEXT NOT NULL, PRIMARY KEY(day,work_id));
