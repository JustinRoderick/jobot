/**
 * Job Search Tool
 *
 * Searches job boards for positions matching user criteria.
 * Uses browser automation to scrape job listings from Indeed, LinkedIn, etc.
 */

import { Type } from "@sinclair/typebox";

import type { MoltbotPluginApi } from "../../../../src/plugins/types.js";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import type { JobStore } from "../db/store.js";
import type {
  JobApplicationConfig,
  Job,
  JobSource,
  JobStatus,
} from "../types.js";

// Tool parameter types
type JobSearchParams = {
  query?: string;
  location?: string;
  source?: JobSource;
  remote_only?: boolean;
  salary_min?: number;
  limit?: number;
  use_preferences?: boolean;
};

export function createJobSearchTool(
  api: MoltbotPluginApi,
  store: JobStore,
  config: JobApplicationConfig,
): AnyAgentTool {
  return {
    name: "job_search",
    label: "Job Search",
    description: `Search for job listings from job boards (Indeed, LinkedIn, etc.).
Use this tool to find new job opportunities matching specific criteria.
Can use saved preferences or custom search parameters.
Returns a summary of found jobs and stores them in the database for later review.`,
    parameters: Type.Object({
      query: Type.Optional(
        Type.String({
          description:
            "Job title or keywords to search for. If not provided, uses saved preferences.",
        }),
      ),
      location: Type.Optional(
        Type.String({
          description:
            "Location to search in (e.g., 'Remote', 'San Francisco, CA')",
        }),
      ),
      source: Type.Optional(
        Type.String({
          description:
            "Job board to search: indeed, linkedin, greenhouse, lever, custom",
        }),
      ),
      remote_only: Type.Optional(
        Type.Boolean({
          description: "Only show remote positions",
        }),
      ),
      salary_min: Type.Optional(
        Type.Number({
          description: "Minimum salary to filter by",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of jobs to return (default: 20)",
        }),
      ),
      use_preferences: Type.Optional(
        Type.Boolean({
          description:
            "Use saved job preferences for search criteria (default: true)",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      const {
        query,
        location,
        source,
        remote_only,
        salary_min,
        limit = 20,
        use_preferences = true,
      } = params as JobSearchParams;

      try {
        // Build search criteria
        const searchQuery =
          query ?? (use_preferences ? config.preferences.titles[0] : undefined);
        const searchLocation =
          location ??
          (use_preferences ? config.preferences.locations[0] : undefined);
        const searchRemote =
          remote_only ??
          (use_preferences ? config.preferences.remoteOnly : false);
        const searchSalaryMin =
          salary_min ??
          (use_preferences ? config.preferences.salaryMin : undefined);
        const searchSource =
          (source as JobSource) ?? config.defaultJobBoards[0] ?? "indeed";

        if (!searchQuery) {
          return {
            content: [
              {
                type: "text",
                text: "Please provide a search query or set up job preferences first.",
              },
            ],
            details: { error: "missing_query" },
          };
        }

        api.logger.info(
          `job_search: Searching for "${searchQuery}" in "${searchLocation ?? "any location"}" on ${searchSource}`,
        );

        // For now, simulate job search results
        // In production, this would use browser automation to scrape job boards
        const mockJobs = generateMockJobs(
          searchQuery,
          searchLocation,
          searchSource,
          limit,
        );

        // Filter by preferences
        let filteredJobs = mockJobs;
        if (searchRemote) {
          filteredJobs = filteredJobs.filter(
            (j) => j.location?.toLowerCase().includes("remote") ?? false,
          );
        }
        if (searchSalaryMin) {
          filteredJobs = filteredJobs.filter(
            (j) => (j.salaryMin ?? 0) >= searchSalaryMin,
          );
        }
        if (use_preferences && config.preferences.excludeCompanies.length > 0) {
          const excludeLower = config.preferences.excludeCompanies.map((c) =>
            c.toLowerCase(),
          );
          filteredJobs = filteredJobs.filter(
            (j) => !excludeLower.includes(j.company.toLowerCase()),
          );
        }

        // Store jobs in database, avoiding duplicates
        let newJobCount = 0;
        const storedJobs: Job[] = [];

        for (const job of filteredJobs) {
          // Check if we already have this job
          const existing = store.getJobByExternalId(
            job.externalId!,
            job.source,
          );
          if (existing) {
            storedJobs.push(existing);
            continue;
          }

          // Create new job
          const newJob = store.createJob({
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
            postedAt: job.postedAt,
          });
          storedJobs.push(newJob);
          newJobCount++;
        }

        // Format results
        const summary = formatJobSummary(storedJobs, newJobCount);

        return {
          content: [{ type: "text", text: summary }],
          details: {
            totalFound: storedJobs.length,
            newJobs: newJobCount,
            source: searchSource,
            query: searchQuery,
            location: searchLocation,
            jobs: storedJobs.slice(0, 10).map((j) => ({
              id: j.id,
              company: j.company,
              title: j.title,
              location: j.location,
              salary: j.salaryMin
                ? `$${j.salaryMin.toLocaleString()}`
                : "Not specified",
              status: j.status,
            })),
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api.logger.error(`job_search error: ${message}`);
        return {
          content: [
            { type: "text", text: `Error searching for jobs: ${message}` },
          ],
          details: { error: message },
        };
      }
    },
  };
}

/**
 * Generate mock job listings for development/testing.
 * In production, this would be replaced with actual web scraping.
 */
function generateMockJobs(
  query: string,
  location: string | undefined,
  source: JobSource,
  limit: number,
): Omit<Job, "id" | "discoveredAt" | "status">[] {
  const companies = [
    "Acme Corp",
    "TechStart Inc",
    "DataFlow Systems",
    "CloudNine Technologies",
    "Innovate Labs",
    "Digital Dynamics",
    "CodeCraft Studios",
    "Quantum Computing Co",
    "AI Solutions Inc",
    "WebScale Technologies",
  ];

  const techStacks = [
    ["TypeScript", "React", "Node.js", "PostgreSQL"],
    ["Python", "Django", "AWS", "Docker"],
    ["Go", "Kubernetes", "gRPC", "Redis"],
    ["Java", "Spring Boot", "MySQL", "Kafka"],
    ["Rust", "WebAssembly", "GraphQL", "MongoDB"],
  ];

  const jobs: Omit<Job, "id" | "discoveredAt" | "status">[] = [];
  const now = Date.now();

  for (let i = 0; i < Math.min(limit, 20); i++) {
    const company = companies[i % companies.length];
    const techStack = techStacks[i % techStacks.length];
    const salaryBase = 100000 + Math.floor(Math.random() * 100000);
    const isRemote = Math.random() > 0.5;

    jobs.push({
      externalId: `${source}-${Date.now()}-${i}`,
      source,
      company,
      title: query.includes("Senior")
        ? query
        : `${query} - ${["Junior", "Mid-level", "Senior"][i % 3]}`,
      location: isRemote ? "Remote" : (location ?? "San Francisco, CA"),
      salaryMin: salaryBase,
      salaryMax: salaryBase + 30000,
      salaryCurrency: "USD",
      description: `We're looking for a talented ${query} to join our team at ${company}. 
You'll work on cutting-edge projects using ${techStack.join(", ")}.
This is a ${isRemote ? "fully remote" : "hybrid"} position with competitive benefits.`,
      techStack,
      url: `https://${source}.com/jobs/${Date.now()}-${i}`,
      postedAt: now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000), // Random within last 7 days
    });
  }

  return jobs;
}

/**
 * Format job results into a human-readable summary.
 */
function formatJobSummary(jobs: Job[], newCount: number): string {
  if (jobs.length === 0) {
    return "No jobs found matching your criteria. Try adjusting your search parameters.";
  }

  const lines: string[] = [];
  lines.push(`Found ${jobs.length} jobs (${newCount} new):\n`);

  for (let i = 0; i < Math.min(jobs.length, 10); i++) {
    const job = jobs[i];
    const salary = job.salaryMin
      ? `$${job.salaryMin.toLocaleString()}${job.salaryMax ? ` - $${job.salaryMax.toLocaleString()}` : "+"}`
      : "Not specified";
    const badge = job.status === "new" ? " [NEW]" : "";

    lines.push(`${i + 1}. **${job.title}** at ${job.company}${badge}`);
    lines.push(
      `   Location: ${job.location ?? "Not specified"} | Salary: ${salary}`,
    );
    if (job.techStack && job.techStack.length > 0) {
      lines.push(`   Tech: ${job.techStack.slice(0, 5).join(", ")}`);
    }
    lines.push("");
  }

  if (jobs.length > 10) {
    lines.push(
      `...and ${jobs.length - 10} more jobs. Use job_track to view all.`,
    );
  }

  lines.push(
    "\nTo apply to a job, tell me the number or ask for more details.",
  );
  lines.push('To reject a job, say "skip #X" or "not interested in #X".');

  return lines.join("\n");
}
