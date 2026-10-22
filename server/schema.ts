import type { Db } from '../src/core/db/database';

/** Reference marketplace server schema. Kept separate from the desktop app's migrations. */
export function migrateServer(db: Db): void {
  if (db.userVersion >= 1) return;
  db.tx(() => {
    db.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at TEXT NOT NULL
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE creators (
        id TEXT PRIMARY KEY,
        account_id TEXT UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
        display_name TEXT NOT NULL,
        bio TEXT NOT NULL DEFAULT '',
        website TEXT NOT NULL DEFAULT '',
        demo INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE listings (
        id TEXT PRIMARY KEY,
        creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        preview TEXT NOT NULL,
        body TEXT NOT NULL,
        category TEXT NOT NULL,
        tags TEXT NOT NULL,
        providers TEXT NOT NULL,
        pricing TEXT NOT NULL,
        trial_eligible INTEGER NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL,
        moderation_note TEXT,
        demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT
      );
      CREATE TABLE listing_versions (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        version TEXT NOT NULL,
        body TEXT NOT NULL,
        changelog TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE entitlements (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('free', 'trial', 'purchase')),
        starts_at TEXT NOT NULL,
        expires_at TEXT,
        revoked_at TEXT
      );
      CREATE INDEX entitlements_account ON entitlements(account_id, listing_id);
      CREATE TABLE reviews (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (listing_id, account_id)
      );
      CREATE TABLE reports (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        details TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL
      );
      CREATE TABLE events (
        listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('view', 'trial', 'acquire')),
        visitor TEXT NOT NULL,
        at TEXT NOT NULL
      );
      CREATE INDEX events_listing ON events(listing_id, kind);
    `);
    db.userVersion = 1;
  });
}
