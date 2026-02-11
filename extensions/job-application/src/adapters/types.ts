/**
 * Types for job site adapters
 */

import type { Job, JobSource } from "../types.js";

/**
 * Search parameters for job boards
 */
export type JobSearchParams = {
  query: string;
  location?: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  postedWithin?: number; // Days
  limit?: number;
};

/**
 * Raw job data from a job board
 */
export type RawJobListing = {
  externalId: string;
  title: string;
  company: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  description?: string;
  requirements?: string[];
  techStack?: string[];
  url: string;
  postedAt?: number;
};

/**
 * Application form field
 */
export type ApplicationFormField = {
  id: string;
  type:
    | "text"
    | "textarea"
    | "select"
    | "checkbox"
    | "file"
    | "email"
    | "phone";
  label: string;
  required: boolean;
  options?: string[]; // For select fields
  value?: string | boolean;
};

/**
 * Application form structure
 */
export type ApplicationForm = {
  url: string;
  fields: ApplicationFormField[];
  submitButtonRef?: string;
};

/**
 * Job site adapter interface
 */
export interface JobSiteAdapter {
  /** Adapter name */
  name: JobSource;

  /** Display label */
  label: string;

  /** Base URL for the job site */
  baseUrl: string;

  /**
   * Build a search URL for the job board
   */
  buildSearchUrl(params: JobSearchParams): string;

  /**
   * Parse job listings from a browser snapshot
   * @param snapshot Browser snapshot content (UI tree)
   * @returns Array of raw job listings
   */
  parseJobList(snapshot: string): RawJobListing[];

  /**
   * Parse detailed job information from a job detail page
   * @param snapshot Browser snapshot content
   * @returns Parsed job details
   */
  parseJobDetail(snapshot: string): Partial<RawJobListing>;

  /**
   * Check if this adapter can handle a given URL
   */
  canHandle(url: string): boolean;

  /**
   * Get the application form structure for a job
   * @param snapshot Browser snapshot of application page
   * @returns Application form structure
   */
  parseApplicationForm?(snapshot: string): ApplicationForm | null;

  /**
   * Fill application form fields
   * @param form Application form structure
   * @param data User data to fill
   * @returns Filled form fields
   */
  fillApplicationForm?(
    form: ApplicationForm,
    data: {
      resume?: { name: string; path: string };
      coverLetter?: string;
      contactInfo?: {
        name?: string;
        email?: string;
        phone?: string;
      };
      answers?: Record<string, string>;
    },
  ): ApplicationFormField[];
}
