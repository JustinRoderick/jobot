/**
 * Data access layer for Job Application plugin
 * Provides typed methods for CRUD operations on all entities
 */

import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

import {
  ensureJobApplicationSchema,
  type JobRow,
  type ApplicationRow,
  type EmailThreadRow,
  type ResumeRow,
  type ApplicationHistoryRow,
} from "./schema.js";
import type {
  Job,
  JobStatus,
  Application,
  ApplicationStatus,
  ApplicationAnswer,
  EmailThread,
  EmailThreadStatus,
  Resume,
  ParsedResumeData,
  JobStats,
  TimelineEntry,
  JobSource,
} from "../types.js";

// =============================================================================
// Store Class
// =============================================================================

export class JobStore {
  private db: DatabaseSync | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly dbPath: string,
    private readonly resumesDir: string,
  ) {}

  // ===========================================================================
  // Initialization
  // ===========================================================================

  private ensureInitialized(): void {
    if (this.db) return;

    // Ensure directories exist
    const dbDir = dirname(this.dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true, mode: 0o700 });
    }
    if (!existsSync(this.resumesDir)) {
      mkdirSync(this.resumesDir, { recursive: true, mode: 0o700 });
    }

    // Open database
    this.db = new DatabaseSync(this.dbPath);
    ensureJobApplicationSchema(this.db);
  }

  // ===========================================================================
  // Jobs
  // ===========================================================================

  createJob(job: Omit<Job, "id" | "discoveredAt" | "status">): Job {
    this.ensureInitialized();
    const now = Date.now();
    const id = randomUUID();

    const fullJob: Job = {
      ...job,
      id,
      discoveredAt: now,
      status: "new",
    };

    this.db!.prepare(
      `
      INSERT INTO jobs (
        id, external_id, source, company, title, location,
        salary_min, salary_max, salary_currency, description,
        requirements, tech_stack, url, posted_at, discovered_at,
        status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      fullJob.id,
      fullJob.externalId ?? null,
      fullJob.source,
      fullJob.company,
      fullJob.title,
      fullJob.location ?? null,
      fullJob.salaryMin ?? null,
      fullJob.salaryMax ?? null,
      fullJob.salaryCurrency ?? "USD",
      fullJob.description ?? null,
      fullJob.requirements ? JSON.stringify(fullJob.requirements) : null,
      fullJob.techStack ? JSON.stringify(fullJob.techStack) : null,
      fullJob.url,
      fullJob.postedAt ?? null,
      fullJob.discoveredAt,
      fullJob.status,
      fullJob.metadata ? JSON.stringify(fullJob.metadata) : null,
    );

    return fullJob;
  }

  getJob(id: string): Job | null {
    this.ensureInitialized();
    const row = this.db!.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as
      | JobRow
      | undefined;
    return row ? this.rowToJob(row) : null;
  }

  getJobByExternalId(externalId: string, source: JobSource): Job | null {
    this.ensureInitialized();
    const row = this.db!.prepare(
      `SELECT * FROM jobs WHERE external_id = ? AND source = ?`,
    ).get(externalId, source) as JobRow | undefined;
    return row ? this.rowToJob(row) : null;
  }

  listJobs(params?: {
    status?: JobStatus;
    source?: JobSource;
    company?: string;
    limit?: number;
    offset?: number;
  }): Job[] {
    this.ensureInitialized();
    const conditions: string[] = [];
    const args: unknown[] = [];

    if (params?.status) {
      conditions.push("status = ?");
      args.push(params.status);
    }
    if (params?.source) {
      conditions.push("source = ?");
      args.push(params.source);
    }
    if (params?.company) {
      conditions.push("company LIKE ?");
      args.push(`%${params.company}%`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = params?.limit ?? 100;
    const offset = params?.offset ?? 0;

    const rows = this.db!.prepare(
      `SELECT * FROM jobs ${whereClause} ORDER BY discovered_at DESC LIMIT ? OFFSET ?`,
    ).all(...args, limit, offset) as JobRow[];

    return rows.map((row) => this.rowToJob(row));
  }

  updateJobStatus(id: string, status: JobStatus): void {
    this.ensureInitialized();
    this.db!.prepare(`UPDATE jobs SET status = ? WHERE id = ?`).run(status, id);
  }

  updateJob(
    id: string,
    updates: Partial<Omit<Job, "id" | "discoveredAt">>,
  ): void {
    this.ensureInitialized();
    const setClauses: string[] = [];
    const args: unknown[] = [];

    if (updates.status !== undefined) {
      setClauses.push("status = ?");
      args.push(updates.status);
    }
    if (updates.description !== undefined) {
      setClauses.push("description = ?");
      args.push(updates.description);
    }
    if (updates.requirements !== undefined) {
      setClauses.push("requirements = ?");
      args.push(JSON.stringify(updates.requirements));
    }
    if (updates.techStack !== undefined) {
      setClauses.push("tech_stack = ?");
      args.push(JSON.stringify(updates.techStack));
    }
    if (updates.metadata !== undefined) {
      setClauses.push("metadata = ?");
      args.push(JSON.stringify(updates.metadata));
    }

    if (setClauses.length === 0) return;

    args.push(id);
    this.db!.prepare(
      `UPDATE jobs SET ${setClauses.join(", ")} WHERE id = ?`,
    ).run(...args);
  }

  private rowToJob(row: JobRow): Job {
    return {
      id: row.id,
      externalId: row.external_id ?? undefined,
      source: row.source as JobSource,
      company: row.company,
      title: row.title,
      location: row.location ?? undefined,
      salaryMin: row.salary_min ?? undefined,
      salaryMax: row.salary_max ?? undefined,
      salaryCurrency: row.salary_currency ?? undefined,
      description: row.description ?? undefined,
      requirements: row.requirements ? JSON.parse(row.requirements) : undefined,
      techStack: row.tech_stack ? JSON.parse(row.tech_stack) : undefined,
      url: row.url,
      postedAt: row.posted_at ?? undefined,
      discoveredAt: row.discovered_at,
      status: row.status as JobStatus,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  // ===========================================================================
  // Applications
  // ===========================================================================

  createApplication(params: {
    jobId: string;
    resumeId?: string;
    coverLetter?: string;
    answers?: ApplicationAnswer[];
    notes?: string;
  }): Application {
    this.ensureInitialized();
    const now = Date.now();
    const id = randomUUID();

    const application: Application = {
      id,
      jobId: params.jobId,
      status: "pending",
      appliedAt: undefined,
      resumeId: params.resumeId,
      coverLetter: params.coverLetter,
      answers: params.answers,
      notes: params.notes,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.db!.prepare(
      `
      INSERT INTO applications (
        id, job_id, status, applied_at, resume_id, cover_letter,
        answers, notes, last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      application.id,
      application.jobId,
      application.status,
      application.appliedAt ?? null,
      application.resumeId ?? null,
      application.coverLetter ?? null,
      application.answers ? JSON.stringify(application.answers) : null,
      application.notes ?? null,
      application.lastActivityAt,
      application.createdAt,
      application.updatedAt,
    );

    return application;
  }

  getApplication(id: string): Application | null {
    this.ensureInitialized();
    const row = this.db!.prepare(`SELECT * FROM applications WHERE id = ?`).get(
      id,
    ) as ApplicationRow | undefined;
    return row ? this.rowToApplication(row) : null;
  }

  getApplicationByJobId(jobId: string): Application | null {
    this.ensureInitialized();
    const row = this.db!.prepare(
      `SELECT * FROM applications WHERE job_id = ?`,
    ).get(jobId) as ApplicationRow | undefined;
    return row ? this.rowToApplication(row) : null;
  }

  listApplications(params?: {
    status?: ApplicationStatus;
    limit?: number;
    offset?: number;
  }): Application[] {
    this.ensureInitialized();
    const conditions: string[] = [];
    const args: unknown[] = [];

    if (params?.status) {
      conditions.push("status = ?");
      args.push(params.status);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = params?.limit ?? 100;
    const offset = params?.offset ?? 0;

    const rows = this.db!.prepare(
      `SELECT * FROM applications ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    ).all(...args, limit, offset) as ApplicationRow[];

    return rows.map((row) => this.rowToApplication(row));
  }

  updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    notes?: string,
  ): void {
    this.ensureInitialized();
    const now = Date.now();
    const app = this.getApplication(id);
    if (!app) return;

    // Update application
    this.db!.prepare(
      `
      UPDATE applications
      SET status = ?, last_activity_at = ?, updated_at = ?, applied_at = COALESCE(applied_at, ?)
      WHERE id = ?
    `,
    ).run(status, now, now, status === "submitted" ? now : null, id);

    // Record history
    const historyId = randomUUID();
    this.db!.prepare(
      `
      INSERT INTO application_history (id, application_id, old_status, new_status, changed_at, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(historyId, id, app.status, status, now, notes ?? null);
  }

  private rowToApplication(row: ApplicationRow): Application {
    return {
      id: row.id,
      jobId: row.job_id,
      status: row.status as ApplicationStatus,
      appliedAt: row.applied_at ?? undefined,
      resumeId: row.resume_id ?? undefined,
      coverLetter: row.cover_letter ?? undefined,
      answers: row.answers ? JSON.parse(row.answers) : undefined,
      notes: row.notes ?? undefined,
      lastActivityAt: row.last_activity_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ===========================================================================
  // Email Threads
  // ===========================================================================

  createEmailThread(params: {
    applicationId: string;
    gmailThreadId?: string;
    subject: string;
    fromEmail: string;
  }): EmailThread {
    this.ensureInitialized();
    const now = Date.now();
    const id = randomUUID();

    const thread: EmailThread = {
      id,
      applicationId: params.applicationId,
      gmailThreadId: params.gmailThreadId,
      subject: params.subject,
      fromEmail: params.fromEmail,
      lastMessageAt: now,
      status: "active",
      messageCount: 1,
    };

    this.db!.prepare(
      `
      INSERT INTO email_threads (
        id, application_id, gmail_thread_id, subject, from_email,
        last_message_at, status, message_count, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      thread.id,
      thread.applicationId,
      thread.gmailThreadId ?? null,
      thread.subject,
      thread.fromEmail,
      thread.lastMessageAt,
      thread.status,
      thread.messageCount,
      null,
    );

    return thread;
  }

  getEmailThreadByGmailId(gmailThreadId: string): EmailThread | null {
    this.ensureInitialized();
    const row = this.db!.prepare(
      `SELECT * FROM email_threads WHERE gmail_thread_id = ?`,
    ).get(gmailThreadId) as EmailThreadRow | undefined;
    return row ? this.rowToEmailThread(row) : null;
  }

  listEmailThreadsForApplication(applicationId: string): EmailThread[] {
    this.ensureInitialized();
    const rows = this.db!.prepare(
      `SELECT * FROM email_threads WHERE application_id = ? ORDER BY last_message_at DESC`,
    ).all(applicationId) as EmailThreadRow[];
    return rows.map((row) => this.rowToEmailThread(row));
  }

  updateEmailThread(id: string, updates: Partial<EmailThread>): void {
    this.ensureInitialized();
    const now = Date.now();
    const setClauses: string[] = [];
    const args: unknown[] = [];

    if (updates.status !== undefined) {
      setClauses.push("status = ?");
      args.push(updates.status);
    }
    if (updates.messageCount !== undefined) {
      setClauses.push("message_count = ?");
      args.push(updates.messageCount);
    }
    if (updates.lastMessageAt !== undefined) {
      setClauses.push("last_message_at = ?");
      args.push(updates.lastMessageAt);
    }

    if (setClauses.length === 0) return;

    args.push(id);
    this.db!.prepare(
      `UPDATE email_threads SET ${setClauses.join(", ")} WHERE id = ?`,
    ).run(...args);
  }

  private rowToEmailThread(row: EmailThreadRow): EmailThread {
    return {
      id: row.id,
      applicationId: row.application_id,
      gmailThreadId: row.gmail_thread_id ?? undefined,
      subject: row.subject,
      fromEmail: row.from_email,
      lastMessageAt: row.last_message_at,
      status: row.status as EmailThreadStatus,
      messageCount: row.message_count,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  // ===========================================================================
  // Resumes
  // ===========================================================================

  createResume(params: {
    name: string;
    filePath: string;
    fileType: "pdf" | "docx" | "txt";
    parsedData?: ParsedResumeData;
    isDefault?: boolean;
  }): Resume {
    this.ensureInitialized();
    const now = Date.now();
    const id = randomUUID();

    // If this is the default, clear other defaults
    if (params.isDefault) {
      this.db!.prepare(`UPDATE resumes SET is_default = 0`).run();
    }

    const resume: Resume = {
      id,
      name: params.name,
      filePath: params.filePath,
      fileType: params.fileType,
      parsedData: params.parsedData,
      isDefault: params.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    };

    this.db!.prepare(
      `
      INSERT INTO resumes (
        id, name, file_path, file_type, parsed_data, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      resume.id,
      resume.name,
      resume.filePath,
      resume.fileType,
      resume.parsedData ? JSON.stringify(resume.parsedData) : null,
      resume.isDefault ? 1 : 0,
      resume.createdAt,
      resume.updatedAt,
    );

    return resume;
  }

  getResume(id: string): Resume | null {
    this.ensureInitialized();
    const row = this.db!.prepare(`SELECT * FROM resumes WHERE id = ?`).get(
      id,
    ) as ResumeRow | undefined;
    return row ? this.rowToResume(row) : null;
  }

  getDefaultResume(): Resume | null {
    this.ensureInitialized();
    const row = this.db!.prepare(
      `SELECT * FROM resumes WHERE is_default = 1`,
    ).get() as ResumeRow | undefined;
    return row ? this.rowToResume(row) : null;
  }

  listResumes(): Resume[] {
    this.ensureInitialized();
    const rows = this.db!.prepare(
      `SELECT * FROM resumes ORDER BY is_default DESC, created_at DESC`,
    ).all() as ResumeRow[];
    return rows.map((row) => this.rowToResume(row));
  }

  setDefaultResume(id: string): void {
    this.ensureInitialized();
    this.db!.prepare(`UPDATE resumes SET is_default = 0`).run();
    this.db!.prepare(`UPDATE resumes SET is_default = 1 WHERE id = ?`).run(id);
  }

  deleteResume(id: string): void {
    this.ensureInitialized();
    this.db!.prepare(`DELETE FROM resumes WHERE id = ?`).run(id);
  }

  private rowToResume(row: ResumeRow): Resume {
    return {
      id: row.id,
      name: row.name,
      filePath: row.file_path,
      fileType: row.file_type as "pdf" | "docx" | "txt",
      parsedData: row.parsed_data ? JSON.parse(row.parsed_data) : undefined,
      isDefault: row.is_default === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  getStats(): JobStats {
    this.ensureInitialized();

    const totalJobs = (
      this.db!.prepare(`SELECT COUNT(*) as count FROM jobs`).get() as {
        count: number;
      }
    ).count;
    const newJobs = (
      this.db!.prepare(
        `SELECT COUNT(*) as count FROM jobs WHERE status = 'new'`,
      ).get() as {
        count: number;
      }
    ).count;
    const appliedJobs = (
      this.db!.prepare(
        `SELECT COUNT(*) as count FROM jobs WHERE status = 'applied'`,
      ).get() as {
        count: number;
      }
    ).count;

    const pendingApplications = (
      this.db!.prepare(
        `SELECT COUNT(*) as count FROM applications WHERE status = 'pending'`,
      ).get() as { count: number }
    ).count;
    const interviewsScheduled = (
      this.db!.prepare(
        `SELECT COUNT(*) as count FROM applications WHERE status = 'interview'`,
      ).get() as { count: number }
    ).count;
    const offersReceived = (
      this.db!.prepare(
        `SELECT COUNT(*) as count FROM applications WHERE status = 'offer'`,
      ).get() as { count: number }
    ).count;
    const rejections = (
      this.db!.prepare(
        `SELECT COUNT(*) as count FROM applications WHERE status = 'rejected'`,
      ).get() as { count: number }
    ).count;

    // Get counts by source
    const bySourceRows = this.db!.prepare(
      `SELECT source, COUNT(*) as count FROM jobs GROUP BY source`,
    ).all() as Array<{ source: string; count: number }>;
    const bySource = {} as Record<JobSource, number>;
    for (const row of bySourceRows) {
      bySource[row.source as JobSource] = row.count;
    }

    // Get counts by job status
    const byStatusRows = this.db!.prepare(
      `SELECT status, COUNT(*) as count FROM jobs GROUP BY status`,
    ).all() as Array<{ status: string; count: number }>;
    const byStatus = {} as Record<string, number>;
    for (const row of byStatusRows) {
      byStatus[row.status] = row.count;
    }

    // Get counts by application status
    const appByStatusRows = this.db!.prepare(
      `SELECT status, COUNT(*) as count FROM applications GROUP BY status`,
    ).all() as Array<{ status: string; count: number }>;
    const applicationsByStatus = {} as Record<string, number>;
    for (const row of appByStatusRows) {
      applicationsByStatus[row.status] = row.count;
    }

    return {
      totalJobs,
      newJobs,
      appliedJobs,
      pendingApplications,
      interviewsScheduled,
      offersReceived,
      rejections,
      bySource,
      byStatus: byStatus as Record<JobStatus, number>,
      applicationsByStatus: applicationsByStatus as Record<
        ApplicationStatus,
        number
      >,
    };
  }

  getTimeline(days: number = 30): TimelineEntry[] {
    this.ensureInitialized();
    const now = Date.now();
    const startTime = now - days * 24 * 60 * 60 * 1000;

    // Get jobs discovered per day
    const jobsPerDay = this.db!.prepare(
      `
      SELECT date(discovered_at / 1000, 'unixepoch') as date, COUNT(*) as count
      FROM jobs
      WHERE discovered_at >= ?
      GROUP BY date(discovered_at / 1000, 'unixepoch')
      ORDER BY date
    `,
    ).all(startTime) as Array<{ date: string; count: number }>;

    // Get applications per day
    const appsPerDay = this.db!.prepare(
      `
      SELECT date(applied_at / 1000, 'unixepoch') as date, COUNT(*) as count
      FROM applications
      WHERE applied_at IS NOT NULL AND applied_at >= ?
      GROUP BY date(applied_at / 1000, 'unixepoch')
      ORDER BY date
    `,
    ).all(startTime) as Array<{ date: string; count: number }>;

    // Combine into timeline
    const timeline = new Map<string, TimelineEntry>();

    for (const row of jobsPerDay) {
      timeline.set(row.date, {
        date: row.date,
        jobsDiscovered: row.count,
        applicationsSubmitted: 0,
        responsesReceived: 0,
      });
    }

    for (const row of appsPerDay) {
      const existing = timeline.get(row.date);
      if (existing) {
        existing.applicationsSubmitted = row.count;
      } else {
        timeline.set(row.date, {
          date: row.date,
          jobsDiscovered: 0,
          applicationsSubmitted: row.count,
          responsesReceived: 0,
        });
      }
    }

    return Array.from(timeline.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
