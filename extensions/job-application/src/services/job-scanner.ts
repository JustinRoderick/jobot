/**
 * Job Scanner Service
 *
 * Background service that periodically scans job boards for new listings.
 * Uses the cron system for scheduling.
 */

import type { MoltbotPluginApi } from "../../../../src/plugins/types.js";
import type { JobStore } from "../db/store.js";
import type { JobApplicationConfig } from "../types.js";

/**
 * Job scanner service that runs periodic job searches.
 */
export function createJobScannerService(
  api: MoltbotPluginApi,
  store: JobStore,
  config: JobApplicationConfig,
) {
  let isRunning = false;
  let scanInterval: ReturnType<typeof setInterval> | null = null;

  return {
    id: "jobbot-scanner",

    async start() {
      api.logger.info(
        `jobbot-scanner: Service started (interval: ${config.scanInterval})`,
      );

      isRunning = true;

      // Parse scan interval (e.g., "6h" -> 6 hours)
      const intervalMs = parseInterval(config.scanInterval);

      if (intervalMs > 0) {
        // Run initial scan after a short delay
        setTimeout(() => {
          if (isRunning) {
            runScan(api, store, config).catch((err) => {
              api.logger.error(`jobbot-scanner: Initial scan failed: ${err}`);
            });
          }
        }, 30000); // 30 second delay for initial scan

        // Set up periodic scanning
        scanInterval = setInterval(() => {
          if (isRunning) {
            runScan(api, store, config).catch((err) => {
              api.logger.error(`jobbot-scanner: Periodic scan failed: ${err}`);
            });
          }
        }, intervalMs);

        api.logger.info(
          `jobbot-scanner: Scheduled to run every ${config.scanInterval} (${intervalMs}ms)`,
        );
      }
    },

    stop() {
      isRunning = false;
      if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
      }
      api.logger.info("jobbot-scanner: Service stopped");
    },
  };
}

/**
 * Run a job scan using configured preferences.
 */
async function runScan(
  api: MoltbotPluginApi,
  store: JobStore,
  config: JobApplicationConfig,
): Promise<void> {
  api.logger.info("jobbot-scanner: Starting job scan...");

  const { preferences, defaultJobBoards, notifications } = config;

  if (preferences.titles.length === 0) {
    api.logger.info("jobbot-scanner: No job titles configured, skipping scan");
    return;
  }

  let totalNewJobs = 0;

  // Scan each job board
  for (const source of defaultJobBoards) {
    for (const title of preferences.titles) {
      for (const location of preferences.locations.length > 0
        ? preferences.locations
        : [""]) {
        try {
          const newJobs = await scanJobBoard(api, store, config, {
            source,
            query: title,
            location: location || undefined,
          });

          totalNewJobs += newJobs;

          api.logger.info(
            `jobbot-scanner: Found ${newJobs} new jobs for "${title}" in "${location || "any location"}" on ${source}`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          api.logger.error(
            `jobbot-scanner: Error scanning ${source} for "${title}": ${message}`,
          );
        }

        // Small delay between requests to be polite
        await sleep(2000);
      }
    }
  }

  api.logger.info(
    `jobbot-scanner: Scan complete. Found ${totalNewJobs} new jobs total.`,
  );

  // Send notification if enabled and new jobs found
  if (notifications.newJobAlerts && notifications.channel && totalNewJobs > 0) {
    const message = formatScanSummary(totalNewJobs);
    api.logger.info(
      `jobbot-scanner: Would send notification to ${notifications.channel}: ${message}`,
    );
    // In production, this would use the message tool to send to the configured channel
  }
}

/**
 * Scan a specific job board with given parameters.
 * Returns the number of new jobs found.
 */
async function scanJobBoard(
  api: MoltbotPluginApi,
  store: JobStore,
  config: JobApplicationConfig,
  params: {
    source: string;
    query: string;
    location?: string;
  },
): Promise<number> {
  // In production, this would use browser automation to scrape job boards
  // For now, we simulate finding jobs

  const mockJobs = generateMockJobs(
    params.query,
    params.location,
    params.source,
  );

  let newJobCount = 0;

  for (const job of mockJobs) {
    // Check if job already exists
    const existing = store.getJobByExternalId(job.externalId, job.source);
    if (existing) continue;

    // Apply filters
    if (!passesFilters(job, config.preferences)) continue;

    // Store new job
    store.createJob({
      externalId: job.externalId,
      source: job.source,
      company: job.company,
      title: job.title,
      location: job.location,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      description: job.description,
      techStack: job.techStack,
      url: job.url,
    });

    newJobCount++;
  }

  return newJobCount;
}

/**
 * Check if a job passes the configured filters.
 */
function passesFilters(
  job: {
    company: string;
    title: string;
    location?: string;
    description?: string;
  },
  preferences: JobApplicationConfig["preferences"],
): boolean {
  const companyLower = job.company.toLowerCase();
  const titleLower = job.title.toLowerCase();
  const locationLower = (job.location ?? "").toLowerCase();
  const descLower = (job.description ?? "").toLowerCase();

  // Check excluded companies
  if (
    preferences.excludeCompanies.some((c) =>
      companyLower.includes(c.toLowerCase()),
    )
  ) {
    return false;
  }

  // Check remote only
  if (preferences.remoteOnly && !locationLower.includes("remote")) {
    return false;
  }

  // Check excluded keywords
  if (
    preferences.excludeKeywords.some(
      (kw) =>
        titleLower.includes(kw.toLowerCase()) ||
        descLower.includes(kw.toLowerCase()),
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Generate mock job listings for testing.
 */
function generateMockJobs(
  query: string,
  location: string | undefined,
  source: string,
): Array<{
  externalId: string;
  source: "indeed" | "linkedin" | "greenhouse" | "lever" | "custom";
  company: string;
  title: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  description?: string;
  techStack?: string[];
  url: string;
}> {
  // Simulate finding 0-3 new jobs per search
  const count = Math.floor(Math.random() * 4);
  const companies = [
    "TechCorp",
    "InnovateLabs",
    "DataDriven Inc",
    "CloudFirst",
    "AI Solutions",
  ];
  const techStacks = [
    ["TypeScript", "React", "Node.js"],
    ["Python", "Django", "PostgreSQL"],
    ["Go", "Kubernetes", "gRPC"],
    ["Java", "Spring", "AWS"],
  ];

  const jobs = [];

  for (let i = 0; i < count; i++) {
    const company = companies[Math.floor(Math.random() * companies.length)];
    const techStack = techStacks[Math.floor(Math.random() * techStacks.length)];
    const salaryBase = 100000 + Math.floor(Math.random() * 80000);

    jobs.push({
      externalId: `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: source as
        | "indeed"
        | "linkedin"
        | "greenhouse"
        | "lever"
        | "custom",
      company,
      title: query,
      location:
        location || (Math.random() > 0.5 ? "Remote" : "San Francisco, CA"),
      salaryMin: salaryBase,
      salaryMax: salaryBase + 30000,
      description: `Join ${company} as a ${query}. Work with ${techStack.join(", ")}.`,
      techStack,
      url: `https://${source}.com/jobs/${Date.now()}`,
    });
  }

  return jobs;
}

/**
 * Format a scan summary notification.
 */
function formatScanSummary(newJobs: number): string {
  if (newJobs === 1) {
    return "🔔 Found 1 new job matching your criteria! Check the JobBot dashboard to review.";
  }
  return `🔔 Found ${newJobs} new jobs matching your criteria! Check the JobBot dashboard to review.`;
}

/**
 * Parse an interval string (e.g., "6h", "30m", "1d") to milliseconds.
 */
function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 0;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

/**
 * Sleep utility.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Export for use in plugin registration.
 */
export type JobScannerService = ReturnType<typeof createJobScannerService>;
