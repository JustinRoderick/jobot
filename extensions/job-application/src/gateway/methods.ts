/**
 * Gateway RPC methods for Job Application plugin
 *
 * These methods are exposed via WebSocket to the web UI
 * for managing jobs, applications, resumes, and preferences.
 */

import type { MoltbotPluginApi } from "../../../../src/plugins/types.js";
import type { JobStore } from "../db/store.js";
import type {
  JobApplicationConfig,
  JobStatus,
  ApplicationStatus,
  JobSource,
} from "../types.js";

/**
 * Register all gateway methods for the job application plugin.
 */
export function registerGatewayMethods(
  api: MoltbotPluginApi,
  store: JobStore,
  config: JobApplicationConfig,
): void {
  // ==========================================================================
  // Job Methods
  // ==========================================================================

  /**
   * List jobs with optional filters
   */
  api.registerGatewayMethod("jobbot.jobs.list", ({ params, respond }) => {
    try {
      const { status, source, company, limit, offset } = (params ?? {}) as {
        status?: JobStatus;
        source?: JobSource;
        company?: string;
        limit?: number;
        offset?: number;
      };

      const jobs = store.listJobs({ status, source, company, limit, offset });
      respond(true, { jobs, count: jobs.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond(false, { error: message });
    }
  });

  /**
   * Get a specific job by ID
   */
  api.registerGatewayMethod("jobbot.jobs.get", ({ params, respond }) => {
    try {
      const { id } = (params ?? {}) as { id: string };
      if (!id) {
        respond(false, { error: "Missing job id" });
        return;
      }

      const job = store.getJob(id);
      if (!job) {
        respond(false, { error: "Job not found" });
        return;
      }

      const application = store.getApplicationByJobId(id);
      respond(true, { job, application });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond(false, { error: message });
    }
  });

  /**
   * Update a job's status
   */
  api.registerGatewayMethod("jobbot.jobs.update", ({ params, respond }) => {
    try {
      const { id, status, metadata } = (params ?? {}) as {
        id: string;
        status?: JobStatus;
        metadata?: Record<string, unknown>;
      };

      if (!id) {
        respond(false, { error: "Missing job id" });
        return;
      }

      if (status) {
        store.updateJobStatus(id, status);
      }
      if (metadata) {
        store.updateJob(id, { metadata });
      }

      const job = store.getJob(id);
      respond(true, { job });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond(false, { error: message });
    }
  });

  // ==========================================================================
  // Application Methods
  // ==========================================================================

  /**
   * List applications with optional filters
   */
  api.registerGatewayMethod(
    "jobbot.applications.list",
    ({ params, respond }) => {
      try {
        const { status, limit, offset } = (params ?? {}) as {
          status?: ApplicationStatus;
          limit?: number;
          offset?: number;
        };

        const applications = store.listApplications({ status, limit, offset });

        // Enrich with job data
        const enriched = applications.map((app) => {
          const job = store.getJob(app.jobId);
          return {
            ...app,
            job: job
              ? {
                  id: job.id,
                  company: job.company,
                  title: job.title,
                  location: job.location,
                  url: job.url,
                }
              : null,
          };
        });

        respond(true, { applications: enriched, count: enriched.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        respond(false, { error: message });
      }
    },
  );

  /**
   * Get a specific application by ID
   */
  api.registerGatewayMethod(
    "jobbot.applications.get",
    ({ params, respond }) => {
      try {
        const { id } = (params ?? {}) as { id: string };
        if (!id) {
          respond(false, { error: "Missing application id" });
          return;
        }

        const application = store.getApplication(id);
        if (!application) {
          respond(false, { error: "Application not found" });
          return;
        }

        const job = store.getJob(application.jobId);
        const emailThreads = store.listEmailThreadsForApplication(id);

        respond(true, { application, job, emailThreads });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        respond(false, { error: message });
      }
    },
  );

  /**
   * Create a new application
   */
  api.registerGatewayMethod(
    "jobbot.applications.create",
    ({ params, respond }) => {
      try {
        const { jobId, resumeId, coverLetter, answers, notes } = (params ??
          {}) as {
          jobId: string;
          resumeId?: string;
          coverLetter?: string;
          answers?: Array<{ question: string; answer: string }>;
          notes?: string;
        };

        if (!jobId) {
          respond(false, { error: "Missing jobId" });
          return;
        }

        // Check if application already exists
        const existing = store.getApplicationByJobId(jobId);
        if (existing) {
          respond(false, {
            error: "Application already exists for this job",
            applicationId: existing.id,
          });
          return;
        }

        const application = store.createApplication({
          jobId,
          resumeId,
          coverLetter,
          answers,
          notes,
        });

        respond(true, { application });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        respond(false, { error: message });
      }
    },
  );

  /**
   * Update an application's status
   */
  api.registerGatewayMethod(
    "jobbot.applications.update",
    ({ params, respond }) => {
      try {
        const { id, status, notes } = (params ?? {}) as {
          id: string;
          status?: ApplicationStatus;
          notes?: string;
        };

        if (!id) {
          respond(false, { error: "Missing application id" });
          return;
        }

        if (status) {
          store.updateApplicationStatus(id, status, notes);
        }

        const application = store.getApplication(id);
        respond(true, { application });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        respond(false, { error: message });
      }
    },
  );

  // ==========================================================================
  // Resume Methods
  // ==========================================================================

  /**
   * List all resumes
   */
  api.registerGatewayMethod("jobbot.resumes.list", ({ respond }) => {
    try {
      const resumes = store.listResumes();
      respond(true, { resumes, count: resumes.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond(false, { error: message });
    }
  });

  /**
   * Get a specific resume
   */
  api.registerGatewayMethod("jobbot.resumes.get", ({ params, respond }) => {
    try {
      const { id } = (params ?? {}) as { id?: string };

      const resume = id ? store.getResume(id) : store.getDefaultResume();
      if (!resume) {
        respond(false, { error: "Resume not found" });
        return;
      }

      respond(true, { resume });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond(false, { error: message });
    }
  });

  /**
   * Set the default resume
   */
  api.registerGatewayMethod(
    "jobbot.resumes.setDefault",
    ({ params, respond }) => {
      try {
        const { id } = (params ?? {}) as { id: string };
        if (!id) {
          respond(false, { error: "Missing resume id" });
          return;
        }

        store.setDefaultResume(id);
        const resume = store.getResume(id);
        respond(true, { resume });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        respond(false, { error: message });
      }
    },
  );

  /**
   * Delete a resume
   */
  api.registerGatewayMethod("jobbot.resumes.delete", ({ params, respond }) => {
    try {
      const { id } = (params ?? {}) as { id: string };
      if (!id) {
        respond(false, { error: "Missing resume id" });
        return;
      }

      store.deleteResume(id);
      respond(true, { deleted: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond(false, { error: message });
    }
  });

  // ==========================================================================
  // Preferences Methods
  // ==========================================================================

  /**
   * Get current job preferences
   */
  api.registerGatewayMethod("jobbot.preferences.get", ({ respond }) => {
    try {
      respond(true, {
        preferences: config.preferences,
        notifications: config.notifications,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond(false, { error: message });
    }
  });

  /**
   * Update job preferences
   * Note: This would require updating the config file - for now returns current
   */
  api.registerGatewayMethod("jobbot.preferences.set", ({ params, respond }) => {
    try {
      // In production, this would update the config file
      // For now, we just acknowledge the request
      respond(true, {
        message: "Preferences update would be saved to config",
        received: params,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond(false, { error: message });
    }
  });

  // ==========================================================================
  // Statistics Methods
  // ==========================================================================

  /**
   * Get job search statistics
   */
  api.registerGatewayMethod("jobbot.stats.summary", ({ respond }) => {
    try {
      const stats = store.getStats();
      respond(true, { stats });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond(false, { error: message });
    }
  });

  /**
   * Get timeline data for charts
   */
  api.registerGatewayMethod("jobbot.stats.timeline", ({ params, respond }) => {
    try {
      const { days = 30 } = (params ?? {}) as { days?: number };
      const timeline = store.getTimeline(days);
      respond(true, { timeline, days });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond(false, { error: message });
    }
  });

  // ==========================================================================
  // Email Thread Methods
  // ==========================================================================

  /**
   * List email threads for an application
   */
  api.registerGatewayMethod("jobbot.emails.list", ({ params, respond }) => {
    try {
      const { applicationId } = (params ?? {}) as { applicationId: string };
      if (!applicationId) {
        respond(false, { error: "Missing applicationId" });
        return;
      }

      const threads = store.listEmailThreadsForApplication(applicationId);
      respond(true, { threads, count: threads.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond(false, { error: message });
    }
  });

  /**
   * Create an email thread for an application
   */
  api.registerGatewayMethod("jobbot.emails.create", ({ params, respond }) => {
    try {
      const { applicationId, gmailThreadId, subject, fromEmail } = (params ??
        {}) as {
        applicationId: string;
        gmailThreadId?: string;
        subject: string;
        fromEmail: string;
      };

      if (!applicationId || !subject || !fromEmail) {
        respond(false, { error: "Missing required fields" });
        return;
      }

      const thread = store.createEmailThread({
        applicationId,
        gmailThreadId,
        subject,
        fromEmail,
      });

      respond(true, { thread });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond(false, { error: message });
    }
  });

  api.logger.info("job-application: Gateway methods registered");
}
