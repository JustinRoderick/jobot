/**
 * MoltBot Job Application Plugin
 *
 * Automated job search, application submission, and tracking.
 * Integrates with browser automation for form filling and email
 * monitoring for response tracking.
 */

import type { MoltbotPluginApi } from "../../src/plugins/types.js";

import { jobApplicationConfigSchema } from "./src/config.js";
import { JobStore } from "./src/db/store.js";
import { createJobSearchTool } from "./src/tools/job-search.js";
import { createJobApplyTool } from "./src/tools/job-apply.js";
import { createJobTrackTool } from "./src/tools/job-track.js";
import { createResumeManageTool } from "./src/tools/resume-manage.js";
import { registerGatewayMethods } from "./src/gateway/methods.js";
import { createEmailMonitorService } from "./src/services/email-monitor.js";
import { createJobScannerService } from "./src/services/job-scanner.js";

const jobApplicationPlugin = {
  id: "job-application",
  name: "Job Application",
  description: "Automated job search, application, and tracking",
  configSchema: jobApplicationConfigSchema,

  register(api: MoltbotPluginApi) {
    const cfg = jobApplicationConfigSchema.parse(api.pluginConfig);
    const resolvedDbPath = api.resolvePath(cfg.dbPath);
    const resolvedResumesDir = api.resolvePath(cfg.resumesDir);

    // Initialize the job store (lazy initialization)
    const store = new JobStore(resolvedDbPath, resolvedResumesDir);

    api.logger.info(
      `job-application: plugin registered (db: ${resolvedDbPath}, resumes: ${resolvedResumesDir})`,
    );

    // ========================================================================
    // Register Tools
    // ========================================================================

    api.registerTool(createJobSearchTool(api, store, cfg), { optional: true });
    api.registerTool(createJobApplyTool(api, store, cfg), { optional: true });
    api.registerTool(createJobTrackTool(api, store, cfg), { optional: true });
    api.registerTool(createResumeManageTool(api, store, cfg), {
      optional: true,
    });

    // ========================================================================
    // Register Gateway Methods (for Web UI)
    // ========================================================================

    registerGatewayMethods(api, store, cfg);

    // ========================================================================
    // Register CLI Commands
    // ========================================================================

    api.registerCli(
      ({ program }) => {
        const jobbot = program
          .command("jobbot")
          .description("Job application plugin commands");

        jobbot
          .command("stats")
          .description("Show job application statistics")
          .action(async () => {
            const stats = store.getStats();
            console.log("Job Application Statistics:");
            console.log(`  Total jobs discovered: ${stats.totalJobs}`);
            console.log(`  New jobs: ${stats.newJobs}`);
            console.log(`  Applied: ${stats.appliedJobs}`);
            console.log(`  Pending applications: ${stats.pendingApplications}`);
            console.log(`  Interviews scheduled: ${stats.interviewsScheduled}`);
            console.log(`  Offers received: ${stats.offersReceived}`);
            console.log(`  Rejections: ${stats.rejections}`);
          });

        jobbot
          .command("list")
          .description("List jobs")
          .option("--status <status>", "Filter by status")
          .option("--limit <n>", "Max results", "20")
          .action(async (opts) => {
            const jobs = store.listJobs({
              status: opts.status,
              limit: parseInt(opts.limit),
            });
            console.log(JSON.stringify(jobs, null, 2));
          });

        jobbot
          .command("applications")
          .description("List applications")
          .option("--status <status>", "Filter by status")
          .option("--limit <n>", "Max results", "20")
          .action(async (opts) => {
            const applications = store.listApplications({
              status: opts.status,
              limit: parseInt(opts.limit),
            });
            console.log(JSON.stringify(applications, null, 2));
          });

        jobbot
          .command("resumes")
          .description("List resumes")
          .action(async () => {
            const resumes = store.listResumes();
            console.log(JSON.stringify(resumes, null, 2));
          });
      },
      { commands: ["jobbot"] },
    );

    // ========================================================================
    // Register Services
    // ========================================================================

    // Email monitor service (tracks application responses)
    const emailMonitor = createEmailMonitorService(api, store, cfg);
    api.registerService(emailMonitor);

    // Job scanner service (periodic job searches)
    const jobScanner = createJobScannerService(api, store, cfg);
    api.registerService(jobScanner);
  },
};

export default jobApplicationPlugin;
