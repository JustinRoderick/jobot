/**
 * Job Track Tool
 *
 * Manages and queries job application status and statistics.
 * Provides views into the job search pipeline.
 */

import { Type } from "@sinclair/typebox";

import type { MoltbotPluginApi } from "../../../../src/plugins/types.js";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import type { JobStore } from "../db/store.js";
import type {
  JobApplicationConfig,
  Job,
  Application,
  JobStatus,
  ApplicationStatus,
} from "../types.js";

// Tool parameter types
type JobTrackParams = {
  action: "list" | "status" | "details" | "update" | "stats" | "summary";
  job_id?: string;
  application_id?: string;
  filter_status?: JobStatus | ApplicationStatus;
  new_status?: JobStatus | ApplicationStatus;
  limit?: number;
  notes?: string;
};

export function createJobTrackTool(
  api: MoltbotPluginApi,
  store: JobStore,
  config: JobApplicationConfig,
): AnyAgentTool {
  return {
    name: "job_track",
    label: "Job Tracker",
    description: `Track and manage job applications and their status.
Actions:
- list: Show jobs or applications with optional status filter
- status: Quick view of a specific job or application
- details: Get full details of a job or application
- update: Change the status of a job or application
- stats: Show overall statistics
- summary: Get a daily summary of job search activity`,
    parameters: Type.Object({
      action: Type.String({
        description:
          "Action to perform: list, status, details, update, stats, or summary",
      }),
      job_id: Type.Optional(
        Type.String({
          description: "Job ID for status, details, or update actions",
        }),
      ),
      application_id: Type.Optional(
        Type.String({
          description: "Application ID for status, details, or update actions",
        }),
      ),
      filter_status: Type.Optional(
        Type.String({
          description:
            "Filter by status (jobs: new, reviewing, approved, rejected, applied; applications: pending, submitted, rejected, interview, offer)",
        }),
      ),
      new_status: Type.Optional(
        Type.String({
          description: "New status for update action",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of results to return (default: 20)",
        }),
      ),
      notes: Type.Optional(
        Type.String({
          description: "Notes to add when updating status",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      const {
        action,
        job_id,
        application_id,
        filter_status,
        new_status,
        limit = 20,
        notes,
      } = params as JobTrackParams;

      try {
        switch (action) {
          case "list":
            return handleList(store, filter_status, limit);

          case "status":
            return handleStatus(store, job_id, application_id);

          case "details":
            return handleDetails(store, job_id, application_id);

          case "update":
            return handleUpdate(
              store,
              job_id,
              application_id,
              new_status,
              notes,
            );

          case "stats":
            return handleStats(store);

          case "summary":
            return handleSummary(store, config);

          default:
            return {
              content: [
                {
                  type: "text",
                  text: `Unknown action: ${action}. Use: list, status, details, update, stats, or summary`,
                },
              ],
              details: { error: "unknown_action" },
            };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.error(`job_track error: ${message}`);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          details: { error: message },
        };
      }
    },
  };
}

function handleList(
  store: JobStore,
  filterStatus: JobStatus | ApplicationStatus | undefined,
  limit: number,
) {
  // Determine if filtering jobs or applications based on status type
  const jobStatuses: JobStatus[] = [
    "new",
    "reviewing",
    "approved",
    "rejected",
    "applied",
    "archived",
  ];
  const appStatuses: ApplicationStatus[] = [
    "pending",
    "submitted",
    "viewed",
    "rejected",
    "interview",
    "offer",
    "withdrawn",
    "closed",
  ];

  const isAppStatus =
    filterStatus && appStatuses.includes(filterStatus as ApplicationStatus);

  if (isAppStatus) {
    const applications = store.listApplications({
      status: filterStatus as ApplicationStatus,
      limit,
    });
    return {
      content: [
        { type: "text", text: formatApplicationList(applications, store) },
      ],
      details: {
        type: "applications",
        count: applications.length,
        applications,
      },
    };
  }

  const jobs = store.listJobs({
    status: filterStatus as JobStatus | undefined,
    limit,
  });
  return {
    content: [{ type: "text", text: formatJobList(jobs) }],
    details: { type: "jobs", count: jobs.length, jobs },
  };
}

function handleStatus(
  store: JobStore,
  jobId: string | undefined,
  applicationId: string | undefined,
) {
  if (applicationId) {
    const app = store.getApplication(applicationId);
    if (!app) {
      return {
        content: [
          { type: "text", text: `Application not found: ${applicationId}` },
        ],
        details: { error: "not_found" },
      };
    }
    const job = store.getJob(app.jobId);
    return {
      content: [
        {
          type: "text",
          text: `**${job?.title ?? "Unknown"}** at **${job?.company ?? "Unknown"}**\nStatus: **${app.status}**\nApplied: ${app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "Not yet"}`,
        },
      ],
      details: { application: app, job },
    };
  }

  if (jobId) {
    const job = store.getJob(jobId);
    if (!job) {
      return {
        content: [{ type: "text", text: `Job not found: ${jobId}` }],
        details: { error: "not_found" },
      };
    }
    const app = store.getApplicationByJobId(jobId);
    return {
      content: [
        {
          type: "text",
          text: `**${job.title}** at **${job.company}**\nJob Status: **${job.status}**${app ? `\nApplication Status: **${app.status}**` : ""}`,
        },
      ],
      details: { job, application: app },
    };
  }

  return {
    content: [
      { type: "text", text: "Please provide a job_id or application_id" },
    ],
    details: { error: "missing_id" },
  };
}

function handleDetails(
  store: JobStore,
  jobId: string | undefined,
  applicationId: string | undefined,
) {
  if (applicationId) {
    const app = store.getApplication(applicationId);
    if (!app) {
      return {
        content: [
          { type: "text", text: `Application not found: ${applicationId}` },
        ],
        details: { error: "not_found" },
      };
    }
    const job = store.getJob(app.jobId);
    const emails = store.listEmailThreadsForApplication(applicationId);

    return {
      content: [
        { type: "text", text: formatApplicationDetails(app, job, emails) },
      ],
      details: { application: app, job, emailThreads: emails },
    };
  }

  if (jobId) {
    const job = store.getJob(jobId);
    if (!job) {
      return {
        content: [{ type: "text", text: `Job not found: ${jobId}` }],
        details: { error: "not_found" },
      };
    }
    const app = store.getApplicationByJobId(jobId);

    return {
      content: [{ type: "text", text: formatJobDetails(job, app) }],
      details: { job, application: app },
    };
  }

  return {
    content: [
      { type: "text", text: "Please provide a job_id or application_id" },
    ],
    details: { error: "missing_id" },
  };
}

function handleUpdate(
  store: JobStore,
  jobId: string | undefined,
  applicationId: string | undefined,
  newStatus: string | undefined,
  notes: string | undefined,
) {
  if (!newStatus) {
    return {
      content: [{ type: "text", text: "Please provide a new_status" }],
      details: { error: "missing_status" },
    };
  }

  if (applicationId) {
    const app = store.getApplication(applicationId);
    if (!app) {
      return {
        content: [
          { type: "text", text: `Application not found: ${applicationId}` },
        ],
        details: { error: "not_found" },
      };
    }

    store.updateApplicationStatus(
      applicationId,
      newStatus as ApplicationStatus,
      notes,
    );
    const job = store.getJob(app.jobId);

    return {
      content: [
        {
          type: "text",
          text: `Updated application for **${job?.title ?? "Unknown"}** at **${job?.company ?? "Unknown"}** to: **${newStatus}**`,
        },
      ],
      details: { applicationId, oldStatus: app.status, newStatus },
    };
  }

  if (jobId) {
    const job = store.getJob(jobId);
    if (!job) {
      return {
        content: [{ type: "text", text: `Job not found: ${jobId}` }],
        details: { error: "not_found" },
      };
    }

    store.updateJobStatus(jobId, newStatus as JobStatus);

    return {
      content: [
        {
          type: "text",
          text: `Updated **${job.title}** at **${job.company}** to: **${newStatus}**`,
        },
      ],
      details: { jobId, oldStatus: job.status, newStatus },
    };
  }

  return {
    content: [
      { type: "text", text: "Please provide a job_id or application_id" },
    ],
    details: { error: "missing_id" },
  };
}

function handleStats(store: JobStore) {
  const stats = store.getStats();
  const text = formatStats(stats);
  return {
    content: [{ type: "text", text }],
    details: { stats },
  };
}

function handleSummary(store: JobStore, config: JobApplicationConfig) {
  const stats = store.getStats();
  const recentJobs = store.listJobs({ status: "new", limit: 5 });
  const pendingApps = store.listApplications({ status: "pending", limit: 5 });
  const interviewApps = store.listApplications({
    status: "interview",
    limit: 5,
  });

  const text = formatDailySummary(
    stats,
    recentJobs,
    pendingApps,
    interviewApps,
  );
  return {
    content: [{ type: "text", text }],
    details: { stats, recentJobs, pendingApps, interviewApps },
  };
}

// Formatting helpers
function formatJobList(jobs: Job[]): string {
  if (jobs.length === 0) {
    return "No jobs found matching the criteria.";
  }

  const lines: string[] = ["## Jobs\n"];
  for (const job of jobs) {
    const salary = job.salaryMin
      ? `$${job.salaryMin.toLocaleString()}`
      : "Not specified";
    lines.push(`- **${job.title}** at ${job.company} [${job.status}]`);
    lines.push(`  Location: ${job.location ?? "N/A"} | Salary: ${salary}`);
    lines.push(`  ID: \`${job.id}\``);
  }
  return lines.join("\n");
}

function formatApplicationList(
  applications: Application[],
  store: JobStore,
): string {
  if (applications.length === 0) {
    return "No applications found matching the criteria.";
  }

  const lines: string[] = ["## Applications\n"];
  for (const app of applications) {
    const job = store.getJob(app.jobId);
    const appliedDate = app.appliedAt
      ? new Date(app.appliedAt).toLocaleDateString()
      : "Pending";
    lines.push(
      `- **${job?.title ?? "Unknown"}** at ${job?.company ?? "Unknown"} [${app.status}]`,
    );
    lines.push(`  Applied: ${appliedDate}`);
    lines.push(`  ID: \`${app.id}\``);
  }
  return lines.join("\n");
}

function formatJobDetails(job: Job, app: Application | null): string {
  const lines: string[] = [];
  lines.push(`## ${job.title}`);
  lines.push(`**Company:** ${job.company}`);
  lines.push(`**Location:** ${job.location ?? "Not specified"}`);
  lines.push(`**Status:** ${job.status}`);
  lines.push(`**Source:** ${job.source}`);

  if (job.salaryMin) {
    const salary = job.salaryMax
      ? `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`
      : `$${job.salaryMin.toLocaleString()}+`;
    lines.push(`**Salary:** ${salary}`);
  }

  if (job.techStack && job.techStack.length > 0) {
    lines.push(`**Tech Stack:** ${job.techStack.join(", ")}`);
  }

  if (job.description) {
    lines.push("");
    lines.push("### Description");
    lines.push(
      job.description.slice(0, 500) +
        (job.description.length > 500 ? "..." : ""),
    );
  }

  lines.push("");
  lines.push(`**URL:** ${job.url}`);
  lines.push(
    `**Discovered:** ${new Date(job.discoveredAt).toLocaleDateString()}`,
  );

  if (app) {
    lines.push("");
    lines.push("### Application");
    lines.push(`**Status:** ${app.status}`);
    if (app.appliedAt) {
      lines.push(
        `**Applied:** ${new Date(app.appliedAt).toLocaleDateString()}`,
      );
    }
  }

  return lines.join("\n");
}

function formatApplicationDetails(
  app: Application,
  job: Job | null,
  emails: { subject: string; status: string }[],
): string {
  const lines: string[] = [];
  lines.push(`## Application Details`);
  lines.push(`**Position:** ${job?.title ?? "Unknown"}`);
  lines.push(`**Company:** ${job?.company ?? "Unknown"}`);
  lines.push(`**Status:** ${app.status}`);

  if (app.appliedAt) {
    lines.push(`**Applied:** ${new Date(app.appliedAt).toLocaleDateString()}`);
  }

  if (app.coverLetter) {
    lines.push("");
    lines.push("### Cover Letter");
    lines.push("```");
    lines.push(
      app.coverLetter.slice(0, 300) +
        (app.coverLetter.length > 300 ? "..." : ""),
    );
    lines.push("```");
  }

  if (emails.length > 0) {
    lines.push("");
    lines.push("### Email Threads");
    for (const email of emails) {
      lines.push(`- ${email.subject} [${email.status}]`);
    }
  }

  if (app.notes) {
    lines.push("");
    lines.push("### Notes");
    lines.push(app.notes);
  }

  return lines.join("\n");
}

function formatStats(stats: {
  totalJobs: number;
  newJobs: number;
  appliedJobs: number;
  pendingApplications: number;
  interviewsScheduled: number;
  offersReceived: number;
  rejections: number;
}): string {
  const lines: string[] = [];
  lines.push("## Job Search Statistics\n");
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Jobs Found | ${stats.totalJobs} |`);
  lines.push(`| New Jobs | ${stats.newJobs} |`);
  lines.push(`| Applications Submitted | ${stats.appliedJobs} |`);
  lines.push(`| Pending Review | ${stats.pendingApplications} |`);
  lines.push(`| Interviews | ${stats.interviewsScheduled} |`);
  lines.push(`| Offers | ${stats.offersReceived} |`);
  lines.push(`| Rejections | ${stats.rejections} |`);

  if (stats.appliedJobs > 0) {
    const responseRate = (
      ((stats.interviewsScheduled + stats.offersReceived + stats.rejections) /
        stats.appliedJobs) *
      100
    ).toFixed(1);
    lines.push("");
    lines.push(`**Response Rate:** ${responseRate}%`);
  }

  return lines.join("\n");
}

function formatDailySummary(
  stats: {
    totalJobs: number;
    newJobs: number;
    appliedJobs: number;
    interviewsScheduled: number;
  },
  recentJobs: Job[],
  pendingApps: Application[],
  interviewApps: Application[],
): string {
  const lines: string[] = [];
  lines.push("## Daily Job Search Summary\n");

  lines.push(`**Jobs Found:** ${stats.totalJobs} (${stats.newJobs} new)`);
  lines.push(`**Applications:** ${stats.appliedJobs}`);
  lines.push(`**Upcoming Interviews:** ${stats.interviewsScheduled}`);
  lines.push("");

  if (recentJobs.length > 0) {
    lines.push("### New Jobs to Review");
    for (const job of recentJobs.slice(0, 3)) {
      lines.push(`- ${job.title} at ${job.company}`);
    }
    if (recentJobs.length > 3) {
      lines.push(`  ...and ${recentJobs.length - 3} more`);
    }
    lines.push("");
  }

  if (interviewApps.length > 0) {
    lines.push("### Interviews Scheduled");
    for (const app of interviewApps) {
      lines.push(`- Application ${app.id.slice(0, 8)}`);
    }
    lines.push("");
  }

  if (pendingApps.length > 0) {
    lines.push("### Pending Applications");
    lines.push(`${pendingApps.length} applications ready to submit.`);
  }

  return lines.join("\n");
}
