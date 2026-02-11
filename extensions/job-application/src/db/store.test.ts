/**
 * Tests for Job Application Store
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { JobStore } from "./store.js";
import type { JobSource, ApplicationStatus } from "../types.js";

describe("JobStore", () => {
  let tempDir: string;
  let store: JobStore;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "jobbot-test-"));
    const dbPath = join(tempDir, "test.sqlite");
    const resumesDir = join(tempDir, "resumes");
    store = new JobStore(dbPath, resumesDir);
  });

  afterEach(() => {
    store.close();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe("Jobs", () => {
    it("should create a job", () => {
      const job = store.createJob({
        externalId: "indeed-123",
        source: "indeed" as JobSource,
        company: "Acme Corp",
        title: "Software Engineer",
        location: "Remote",
        salaryMin: 120000,
        salaryMax: 150000,
        url: "https://indeed.com/job/123",
      });

      expect(job.id).toBeDefined();
      expect(job.company).toBe("Acme Corp");
      expect(job.title).toBe("Software Engineer");
      expect(job.status).toBe("new");
      expect(job.discoveredAt).toBeDefined();
    });

    it("should get a job by ID", () => {
      const created = store.createJob({
        source: "linkedin" as JobSource,
        company: "TechStart",
        title: "Full Stack Developer",
        url: "https://linkedin.com/jobs/456",
      });

      const retrieved = store.getJob(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.company).toBe("TechStart");
    });

    it("should get a job by external ID", () => {
      store.createJob({
        externalId: "gh-789",
        source: "greenhouse" as JobSource,
        company: "DataFlow",
        title: "Backend Engineer",
        url: "https://greenhouse.io/job/789",
      });

      const retrieved = store.getJobByExternalId("gh-789", "greenhouse");

      expect(retrieved).not.toBeNull();
      expect(retrieved!.company).toBe("DataFlow");
    });

    it("should list jobs with filters", () => {
      store.createJob({
        source: "indeed" as JobSource,
        company: "Company A",
        title: "Job A",
        url: "https://example.com/a",
      });

      store.createJob({
        source: "linkedin" as JobSource,
        company: "Company B",
        title: "Job B",
        url: "https://example.com/b",
      });

      const allJobs = store.listJobs();
      expect(allJobs.length).toBe(2);

      const indeedJobs = store.listJobs({ source: "indeed" });
      expect(indeedJobs.length).toBe(1);
      expect(indeedJobs[0].company).toBe("Company A");
    });

    it("should update job status", () => {
      const job = store.createJob({
        source: "indeed" as JobSource,
        company: "Test Co",
        title: "Test Job",
        url: "https://example.com/test",
      });

      expect(job.status).toBe("new");

      store.updateJobStatus(job.id, "approved");

      const updated = store.getJob(job.id);
      expect(updated!.status).toBe("approved");
    });
  });

  describe("Applications", () => {
    let jobId: string;

    beforeEach(() => {
      const job = store.createJob({
        source: "indeed" as JobSource,
        company: "Acme Corp",
        title: "Software Engineer",
        url: "https://example.com/job",
      });
      jobId = job.id;
    });

    it("should create an application", () => {
      const app = store.createApplication({
        jobId,
        coverLetter: "Dear Hiring Manager...",
        notes: "Good match",
      });

      expect(app.id).toBeDefined();
      expect(app.jobId).toBe(jobId);
      expect(app.status).toBe("pending");
      expect(app.coverLetter).toBe("Dear Hiring Manager...");
    });

    it("should get application by ID", () => {
      const created = store.createApplication({ jobId });

      const retrieved = store.getApplication(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
    });

    it("should get application by job ID", () => {
      store.createApplication({ jobId });

      const retrieved = store.getApplicationByJobId(jobId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.jobId).toBe(jobId);
    });

    it("should update application status", () => {
      const app = store.createApplication({ jobId });

      store.updateApplicationStatus(app.id, "submitted" as ApplicationStatus);

      const updated = store.getApplication(app.id);
      expect(updated!.status).toBe("submitted");
      expect(updated!.appliedAt).toBeDefined();
    });

    it("should list applications with filters", () => {
      const app1 = store.createApplication({ jobId });
      store.updateApplicationStatus(app1.id, "submitted" as ApplicationStatus);

      // Create another job and application
      const job2 = store.createJob({
        source: "linkedin" as JobSource,
        company: "Other Co",
        title: "Other Job",
        url: "https://example.com/other",
      });
      store.createApplication({ jobId: job2.id });

      const allApps = store.listApplications();
      expect(allApps.length).toBe(2);

      const submittedApps = store.listApplications({ status: "submitted" });
      expect(submittedApps.length).toBe(1);
    });
  });

  describe("Resumes", () => {
    it("should create a resume", () => {
      const resume = store.createResume({
        name: "My Resume",
        filePath: "/path/to/resume.pdf",
        fileType: "pdf",
        isDefault: true,
      });

      expect(resume.id).toBeDefined();
      expect(resume.name).toBe("My Resume");
      expect(resume.isDefault).toBe(true);
    });

    it("should get default resume", () => {
      store.createResume({
        name: "Resume 1",
        filePath: "/path/to/1.pdf",
        fileType: "pdf",
        isDefault: false,
      });

      store.createResume({
        name: "Resume 2",
        filePath: "/path/to/2.pdf",
        fileType: "pdf",
        isDefault: true,
      });

      const defaultResume = store.getDefaultResume();

      expect(defaultResume).not.toBeNull();
      expect(defaultResume!.name).toBe("Resume 2");
    });

    it("should set default resume", () => {
      const resume1 = store.createResume({
        name: "Resume 1",
        filePath: "/path/to/1.pdf",
        fileType: "pdf",
        isDefault: true,
      });

      const resume2 = store.createResume({
        name: "Resume 2",
        filePath: "/path/to/2.pdf",
        fileType: "pdf",
        isDefault: false,
      });

      store.setDefaultResume(resume2.id);

      const updated1 = store.getResume(resume1.id);
      const updated2 = store.getResume(resume2.id);

      expect(updated1!.isDefault).toBe(false);
      expect(updated2!.isDefault).toBe(true);
    });

    it("should delete a resume", () => {
      const resume = store.createResume({
        name: "To Delete",
        filePath: "/path/to/delete.pdf",
        fileType: "pdf",
      });

      store.deleteResume(resume.id);

      const deleted = store.getResume(resume.id);
      expect(deleted).toBeNull();
    });
  });

  describe("Email Threads", () => {
    let applicationId: string;

    beforeEach(() => {
      const job = store.createJob({
        source: "indeed" as JobSource,
        company: "Acme Corp",
        title: "Software Engineer",
        url: "https://example.com/job",
      });
      const app = store.createApplication({ jobId: job.id });
      applicationId = app.id;
    });

    it("should create an email thread", () => {
      const thread = store.createEmailThread({
        applicationId,
        gmailThreadId: "gmail-abc123",
        subject: "Re: Your Application",
        fromEmail: "hr@acme.com",
      });

      expect(thread.id).toBeDefined();
      expect(thread.applicationId).toBe(applicationId);
      expect(thread.subject).toBe("Re: Your Application");
    });

    it("should get email thread by Gmail ID", () => {
      store.createEmailThread({
        applicationId,
        gmailThreadId: "gmail-xyz789",
        subject: "Interview Request",
        fromEmail: "recruiter@acme.com",
      });

      const retrieved = store.getEmailThreadByGmailId("gmail-xyz789");

      expect(retrieved).not.toBeNull();
      expect(retrieved!.subject).toBe("Interview Request");
    });

    it("should list email threads for application", () => {
      store.createEmailThread({
        applicationId,
        subject: "Thread 1",
        fromEmail: "a@example.com",
      });

      store.createEmailThread({
        applicationId,
        subject: "Thread 2",
        fromEmail: "b@example.com",
      });

      const threads = store.listEmailThreadsForApplication(applicationId);

      expect(threads.length).toBe(2);
    });
  });

  describe("Statistics", () => {
    it("should return correct stats", () => {
      // Create some jobs
      const job1 = store.createJob({
        source: "indeed" as JobSource,
        company: "A",
        title: "Job A",
        url: "https://a.com",
      });

      const job2 = store.createJob({
        source: "linkedin" as JobSource,
        company: "B",
        title: "Job B",
        url: "https://b.com",
      });

      // Create applications
      const app1 = store.createApplication({ jobId: job1.id });
      store.updateApplicationStatus(app1.id, "submitted" as ApplicationStatus);
      store.updateApplicationStatus(app1.id, "interview" as ApplicationStatus);

      const app2 = store.createApplication({ jobId: job2.id });
      store.updateApplicationStatus(app2.id, "submitted" as ApplicationStatus);
      store.updateApplicationStatus(app2.id, "rejected" as ApplicationStatus);

      const stats = store.getStats();

      expect(stats.totalJobs).toBe(2);
      expect(stats.interviewsScheduled).toBe(1);
      expect(stats.rejections).toBe(1);
    });
  });
});
