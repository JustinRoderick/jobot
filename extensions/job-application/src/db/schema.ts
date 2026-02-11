/**
 * SQLite database schema for Job Application plugin
 */

import type { DatabaseSync } from "node:sqlite";

/**
 * Ensures all required tables and indexes exist in the database.
 * Uses CREATE IF NOT EXISTS for idempotency.
 */
export function ensureJobApplicationSchema(db: DatabaseSync): void {
  // Jobs table - stores discovered job listings
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      external_id TEXT,
      source TEXT NOT NULL,
      company TEXT NOT NULL,
      title TEXT NOT NULL,
      location TEXT,
      salary_min INTEGER,
      salary_max INTEGER,
      salary_currency TEXT DEFAULT 'USD',
      description TEXT,
      requirements TEXT,
      tech_stack TEXT,
      url TEXT NOT NULL,
      posted_at INTEGER,
      discovered_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      metadata TEXT
    );
  `);

  // Applications table - tracks submitted applications
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id),
      status TEXT NOT NULL DEFAULT 'pending',
      applied_at INTEGER,
      resume_id TEXT,
      cover_letter TEXT,
      answers TEXT,
      notes TEXT,
      last_activity_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Email threads table - links email conversations to applications
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_threads (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id),
      gmail_thread_id TEXT,
      subject TEXT NOT NULL,
      from_email TEXT NOT NULL,
      last_message_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      message_count INTEGER NOT NULL DEFAULT 1,
      metadata TEXT
    );
  `);

  // Resumes table - stores resume metadata and parsed data
  db.exec(`
    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      parsed_data TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Preferences table - key-value store for user preferences
  db.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Application history table - tracks status changes over time
  db.exec(`
    CREATE TABLE IF NOT EXISTS application_history (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id),
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_at INTEGER NOT NULL,
      notes TEXT
    );
  `);

  // Create indexes for common queries
  db.exec(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_jobs_discovered_at ON jobs(discovered_at);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_jobs_external_id ON jobs(external_id);`,
  );

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_applications_applied_at ON applications(applied_at);`,
  );

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_email_threads_application_id ON email_threads(application_id);`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_email_threads_gmail_thread_id ON email_threads(gmail_thread_id);`,
  );

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_application_history_application_id ON application_history(application_id);`,
  );
}

/**
 * Database row types matching the schema
 */
export type JobRow = {
  id: string;
  external_id: string | null;
  source: string;
  company: string;
  title: string;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  description: string | null;
  requirements: string | null;
  tech_stack: string | null;
  url: string;
  posted_at: number | null;
  discovered_at: number;
  status: string;
  metadata: string | null;
};

export type ApplicationRow = {
  id: string;
  job_id: string;
  status: string;
  applied_at: number | null;
  resume_id: string | null;
  cover_letter: string | null;
  answers: string | null;
  notes: string | null;
  last_activity_at: number;
  created_at: number;
  updated_at: number;
};

export type EmailThreadRow = {
  id: string;
  application_id: string;
  gmail_thread_id: string | null;
  subject: string;
  from_email: string;
  last_message_at: number;
  status: string;
  message_count: number;
  metadata: string | null;
};

export type ResumeRow = {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  parsed_data: string | null;
  is_default: number;
  created_at: number;
  updated_at: number;
};

export type PreferenceRow = {
  key: string;
  value: string;
  updated_at: number;
};

export type ApplicationHistoryRow = {
  id: string;
  application_id: string;
  old_status: string | null;
  new_status: string;
  changed_at: number;
  notes: string | null;
};
