/**
 * Jobs Dashboard View
 *
 * Displays discovered job listings with filtering, sorting, and actions.
 */

import { html, nothing } from "lit";

import { formatAgo } from "../format";

export type Job = {
  id: string;
  externalId?: string;
  source: string;
  company: string;
  title: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  description?: string;
  techStack?: string[];
  url: string;
  discoveredAt: number;
  status: string;
};

export type JobsProps = {
  loading: boolean;
  jobs: Job[];
  error: string | null;
  filters: {
    status: string;
    source: string;
    search: string;
  };
  selectedJob: Job | null;
  onFiltersChange: (filters: JobsProps["filters"]) => void;
  onRefresh: () => void;
  onSelectJob: (job: Job | null) => void;
  onUpdateStatus: (jobId: string, status: string) => void;
  onApply: (jobId: string) => void;
};

const JOB_STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "applied", label: "Applied" },
  { value: "archived", label: "Archived" },
];

const JOB_SOURCES = [
  { value: "", label: "All Sources" },
  { value: "indeed", label: "Indeed" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "greenhouse", label: "Greenhouse" },
  { value: "lever", label: "Lever" },
  { value: "custom", label: "Custom" },
];

export function renderJobs(props: JobsProps) {
  const filteredJobs = filterJobs(props.jobs, props.filters);

  return html`
    <section class="jobs-view">
      <div class="card">
        <div
          class="row"
          style="justify-content: space-between; align-items: center;"
        >
          <div>
            <div class="card-title">Job Listings</div>
            <div class="card-sub">
              ${props.jobs.length} jobs found
              ${filteredJobs.length !== props.jobs.length
                ? ` (${filteredJobs.length} matching filters)`
                : ""}
            </div>
          </div>
          <button
            class="btn"
            ?disabled=${props.loading}
            @click=${props.onRefresh}
          >
            ${props.loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        ${renderFilters(props)}
        ${props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${props.error}
            </div>`
          : nothing}

        <div class="jobs-layout" style="margin-top: 16px;">
          <div class="jobs-list">
            ${filteredJobs.length === 0
              ? html`<div
                  class="muted"
                  style="padding: 20px; text-align: center;"
                >
                  No jobs found matching your criteria.
                </div>`
              : filteredJobs.map((job) => renderJobCard(job, props))}
          </div>

          ${props.selectedJob
            ? html`<div class="job-detail-panel">
                ${renderJobDetail(props.selectedJob, props)}
              </div>`
            : nothing}
        </div>
      </div>
    </section>
  `;
}

function renderFilters(props: JobsProps) {
  return html`
    <div
      class="filters"
      style="margin-top: 14px; display: flex; gap: 12px; flex-wrap: wrap;"
    >
      <label class="field">
        <span>Status</span>
        <select
          .value=${props.filters.status}
          @change=${(e: Event) =>
            props.onFiltersChange({
              ...props.filters,
              status: (e.target as HTMLSelectElement).value,
            })}
        >
          ${JOB_STATUSES.map(
            (s) => html`<option value=${s.value}>${s.label}</option>`,
          )}
        </select>
      </label>

      <label class="field">
        <span>Source</span>
        <select
          .value=${props.filters.source}
          @change=${(e: Event) =>
            props.onFiltersChange({
              ...props.filters,
              source: (e.target as HTMLSelectElement).value,
            })}
        >
          ${JOB_SOURCES.map(
            (s) => html`<option value=${s.value}>${s.label}</option>`,
          )}
        </select>
      </label>

      <label class="field" style="flex: 1; min-width: 200px;">
        <span>Search</span>
        <input
          type="text"
          placeholder="Company, title, or keywords..."
          .value=${props.filters.search}
          @input=${(e: Event) =>
            props.onFiltersChange({
              ...props.filters,
              search: (e.target as HTMLInputElement).value,
            })}
        />
      </label>
    </div>
  `;
}

function renderJobCard(job: Job, props: JobsProps) {
  const isSelected = props.selectedJob?.id === job.id;
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const statusClass = `status-${job.status}`;

  return html`
    <div
      class="job-card ${isSelected ? "selected" : ""}"
      @click=${() => props.onSelectJob(isSelected ? null : job)}
    >
      <div class="job-card-header">
        <div class="job-title">${job.title}</div>
        <span class="job-status ${statusClass}">${job.status}</span>
      </div>
      <div class="job-company">${job.company}</div>
      <div class="job-meta">
        <span>${job.location ?? "Location not specified"}</span>
        <span>${salary}</span>
      </div>
      <div class="job-footer">
        <span class="job-source">${job.source}</span>
        <span class="job-date">${formatAgo(job.discoveredAt)}</span>
      </div>
    </div>
  `;
}

function renderJobDetail(job: Job, props: JobsProps) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);

  return html`
    <div class="job-detail">
      <div class="job-detail-header">
        <h2>${job.title}</h2>
        <button class="btn-close" @click=${() => props.onSelectJob(null)}>
          ×
        </button>
      </div>

      <div class="job-detail-meta">
        <div class="meta-row">
          <span class="label">Company:</span>
          <span>${job.company}</span>
        </div>
        <div class="meta-row">
          <span class="label">Location:</span>
          <span>${job.location ?? "Not specified"}</span>
        </div>
        <div class="meta-row">
          <span class="label">Salary:</span>
          <span>${salary}</span>
        </div>
        <div class="meta-row">
          <span class="label">Source:</span>
          <span>${job.source}</span>
        </div>
        <div class="meta-row">
          <span class="label">Status:</span>
          <span class="status-${job.status}">${job.status}</span>
        </div>
      </div>

      ${job.techStack && job.techStack.length > 0
        ? html`
            <div class="job-tech-stack">
              <h4>Tech Stack</h4>
              <div class="tech-tags">
                ${job.techStack.map(
                  (tech) => html`<span class="tech-tag">${tech}</span>`,
                )}
              </div>
            </div>
          `
        : nothing}
      ${job.description
        ? html`
            <div class="job-description">
              <h4>Description</h4>
              <p>${job.description}</p>
            </div>
          `
        : nothing}

      <div class="job-actions">
        ${job.status === "new" || job.status === "reviewing"
          ? html`
              <button
                class="btn primary"
                @click=${() => props.onUpdateStatus(job.id, "approved")}
              >
                Approve
              </button>
              <button
                class="btn danger"
                @click=${() => props.onUpdateStatus(job.id, "rejected")}
              >
                Reject
              </button>
            `
          : nothing}
        ${job.status === "approved"
          ? html`
              <button class="btn primary" @click=${() => props.onApply(job.id)}>
                Apply Now
              </button>
            `
          : nothing}
        <a href=${job.url} target="_blank" class="btn">View Original</a>
      </div>
    </div>
  `;
}

function filterJobs(jobs: Job[], filters: JobsProps["filters"]): Job[] {
  return jobs.filter((job) => {
    if (filters.status && job.status !== filters.status) return false;
    if (filters.source && job.source !== filters.source) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const matchesCompany = job.company.toLowerCase().includes(search);
      const matchesTitle = job.title.toLowerCase().includes(search);
      const matchesTech = job.techStack?.some((t) =>
        t.toLowerCase().includes(search),
      );
      if (!matchesCompany && !matchesTitle && !matchesTech) return false;
    }
    return true;
  });
}

function formatSalary(min?: number, max?: number, currency?: string): string {
  if (!min && !max) return "Not specified";
  const curr = currency ?? "USD";
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: curr,
    maximumFractionDigits: 0,
  });
  if (min && max) {
    return `${formatter.format(min)} - ${formatter.format(max)}`;
  }
  if (min) {
    return `${formatter.format(min)}+`;
  }
  return `Up to ${formatter.format(max!)}`;
}
