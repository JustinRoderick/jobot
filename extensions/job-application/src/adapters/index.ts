/**
 * Job Site Adapters Index
 *
 * Exports all available job site adapters and provides a registry
 * for looking up adapters by name or URL.
 */

import { indeedAdapter } from "./indeed.js";
import { linkedinAdapter } from "./linkedin.js";
import { greenhouseAdapter } from "./greenhouse.js";
import type { JobSiteAdapter } from "./types.js";
import type { JobSource } from "../types.js";

// Export individual adapters
export { indeedAdapter } from "./indeed.js";
export { linkedinAdapter } from "./linkedin.js";
export { greenhouseAdapter } from "./greenhouse.js";
export type {
  JobSiteAdapter,
  JobSearchParams,
  RawJobListing,
  ApplicationForm,
  ApplicationFormField,
} from "./types.js";

/**
 * Registry of all available job site adapters.
 */
export const adapters: Record<JobSource, JobSiteAdapter> = {
  indeed: indeedAdapter,
  linkedin: linkedinAdapter,
  greenhouse: greenhouseAdapter,
  lever: greenhouseAdapter, // Lever is similar to Greenhouse
  custom: indeedAdapter, // Fallback to Indeed patterns for custom sites
};

/**
 * Get an adapter by source name.
 */
export function getAdapter(source: JobSource): JobSiteAdapter {
  return adapters[source] ?? indeedAdapter;
}

/**
 * Find an adapter that can handle a given URL.
 */
export function findAdapterForUrl(url: string): JobSiteAdapter | null {
  for (const adapter of Object.values(adapters)) {
    if (adapter.canHandle(url)) {
      return adapter;
    }
  }
  return null;
}

/**
 * Get all available adapter names.
 */
export function getAvailableAdapters(): JobSource[] {
  return Object.keys(adapters) as JobSource[];
}
