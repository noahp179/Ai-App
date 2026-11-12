import type { Db } from '../src/core/db/database';

/**
 * Classroom service schema. Its own database: student records never share a file with the marketplace or with the
 * desktop app's local data. SQL is kept to the subset SQLite and PostgreSQL share (see docs/ARCHITECTURE.md).
 */
export function migrateClassroom(db: Db): void {
  if (db.userVersion >= 1) return;
  db.tx(() => {
    db.exec(`
      CREATE TABLE schools (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        settings TEXT NOT NULL DEFAULT '{}',
        ai_key_enc TEXT,
        ai_key_hint TEXT,
        under13_by TEXT,
        under13_at TEXT,
        invite_code TEXT,
        invite_expires TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
        display_name TEXT NOT NULL,
        login TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE classes (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        section TEXT NOT NULL DEFAULT '',
        school_year TEXT NOT NULL DEFAULT '',
        course_id TEXT,
        course_label TEXT,
        ends_on TEXT,
        under13 INTEGER NOT NULL DEFAULT 0,
        archived_at TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE class_members (
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('teacher', 'co_teacher', 'student')),
        status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'removed')),
        joined_at TEXT NOT NULL,
        PRIMARY KEY (class_id, user_id)
      );
      CREATE INDEX class_members_user ON class_members(user_id);
      CREATE TABLE join_codes (
        code TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        require_approval INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE accommodations (
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (class_id, user_id)
      );

      CREATE TABLE materials (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        folder TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL,
        status_detail TEXT NOT NULL DEFAULT '',
        pages INTEGER NOT NULL DEFAULT 0,
        scan TEXT NOT NULL DEFAULT '',
        storage_key TEXT NOT NULL,
        ai_file_id TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX materials_class ON materials(class_id);
      CREATE TABLE material_versions (
        material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        storage_key TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (material_id, version)
      );
      CREATE TABLE material_pages (
        material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        page INTEGER NOT NULL,
        text TEXT NOT NULL,
        PRIMARY KEY (material_id, page)
      );

      CREATE TABLE assessments (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        instructions TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
        version INTEGER NOT NULL DEFAULT 1,
        settings TEXT NOT NULL,
        material_ids TEXT NOT NULL DEFAULT '[]',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX assessments_class ON assessments(class_id);
      CREATE TABLE assessment_items (
        id TEXT NOT NULL,
        assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        position INTEGER NOT NULL,
        points REAL NOT NULL,
        question TEXT NOT NULL,
        long INTEGER NOT NULL DEFAULT 0,
        ai_drafted INTEGER NOT NULL DEFAULT 0,
        reviewed_by TEXT,
        expectation_ids TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY (assessment_id, version, id)
      );

      CREATE TABLE attempts (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        number INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted')),
        acknowledged_at TEXT NOT NULL,
        started_at TEXT NOT NULL,
        deadline TEXT,
        submitted_at TEXT,
        auto_submitted INTEGER NOT NULL DEFAULT 0,
        reference TEXT,
        item_order TEXT NOT NULL DEFAULT '[]',
        responses TEXT NOT NULL DEFAULT '{}',
        flags TEXT NOT NULL DEFAULT '[]',
        seconds TEXT NOT NULL DEFAULT '{}',
        accommodation TEXT NOT NULL DEFAULT '{}',
        overall_comment TEXT NOT NULL DEFAULT '',
        released_at TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE (assessment_id, user_id, number)
      );
      CREATE INDEX attempts_user ON attempts(user_id);
      CREATE TABLE snapshots (
        attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL,
        at TEXT NOT NULL,
        text TEXT NOT NULL
      );
      CREATE INDEX snapshots_attempt ON snapshots(attempt_id, item_id, at);
      CREATE TABLE chat_messages (
        id TEXT PRIMARY KEY,
        attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('student', 'assistant')),
        content TEXT NOT NULL,
        payload TEXT,
        citations TEXT NOT NULL DEFAULT '[]',
        kind TEXT NOT NULL DEFAULT 'message',
        status TEXT NOT NULL DEFAULT 'complete',
        error TEXT,
        model TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX chat_attempt ON chat_messages(attempt_id, created_at);
      CREATE TABLE integrity_events (
        id TEXT PRIMARY KEY,
        attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        item_id TEXT,
        at TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX integrity_attempt ON integrity_events(attempt_id, at);

      CREATE TABLE grades (
        attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL,
        auto_score REAL,
        auto_result TEXT,
        suggestion TEXT,
        suggestion_status TEXT NOT NULL DEFAULT 'none',
        suggestion_error TEXT,
        score REAL,
        source TEXT,
        levels TEXT,
        override_reason TEXT NOT NULL DEFAULT '',
        comment TEXT NOT NULL DEFAULT '',
        highlights TEXT NOT NULL DEFAULT '[]',
        graded_by TEXT,
        graded_at TEXT,
        PRIMARY KEY (attempt_id, item_id)
      );
      CREATE TABLE ai_evaluations (
        attempt_id TEXT PRIMARY KEY REFERENCES attempts(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'none',
        error TEXT,
        rubric TEXT NOT NULL,
        suggested TEXT,
        evidence_removed INTEGER NOT NULL DEFAULT 0,
        model TEXT,
        final TEXT,
        student_reply TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE ai_jobs (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
        item_id TEXT,
        kind TEXT NOT NULL CHECK (kind IN ('evaluate', 'grade_written')),
        status TEXT NOT NULL CHECK (status IN ('queued', 'budget', 'batch', 'done', 'failed')),
        batch_id TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        finished_at TEXT
      );
      CREATE INDEX ai_jobs_status ON ai_jobs(status, batch_id);
      CREATE TABLE comment_bank (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE audit_log (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        at TEXT NOT NULL,
        actor_id TEXT,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX audit_school ON audit_log(school_id, at);
      CREATE TABLE ai_usage (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        class_id TEXT,
        assessment_id TEXT,
        kind TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read INTEGER NOT NULL DEFAULT 0,
        cache_write INTEGER NOT NULL DEFAULT 0,
        cost REAL NOT NULL DEFAULT 0,
        at TEXT NOT NULL
      );
      CREATE INDEX ai_usage_school ON ai_usage(school_id, at);
    `);
    db.userVersion = 1;
  });
}
