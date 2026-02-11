import { html, nothing } from "lit";

import { formatAgo } from "../format";

export type Application = {
  id: string;
  jobId: string;
  status: string;
  appliedAt?: number;
  resumeId?: string;
  coverLetter?: string;
  notes?: string;
  lastActivityAt: number;
  createdAt: number;
  updatedAt: number;
  job?: {
    id: string;
    company: string;
    title: string;
    location?: string;
    url: string;
  } | null;
};

export type EmailThread = {
  id: string;
  subject: string;
  fromEmail: string;
  lastMessageAt: number;
  status: string;
  messageCount: number;
};

export type ApplicationsProps = {
  loading: boolean;
  applications: Application[];
  error: string | null;
  viewMode: "pipeline" | "list";
  selectedApplication: Application | null;
  emailThreads: EmailThread[];
  onRefresh: () => void;
  onViewModeChange: (mode: "pipeline" | "list") => void;
  onSelectApplication: (app: Application | null) => void;
  onUpdateStatus: (appId: string, status: string, notes?: string) => void;
};

const APPLICATION_STATUSES = [
  { value: "pending", label: "Pending", color: "#f59e0b" },
  { value: "submitted", label: "Submitted", color: "#3b82f6" },
  { value: "viewed", label: "Viewed", color: "#8b5cf6" },
  { value: "interview", label: "Interview", color: "#10b981" },
  { value: "offer", label: "Offer", color: "#22c55e" },
  { value: "rejected", label: "Rejected", color: "#ef4444" },
  { value: "withdrawn", label: "Withdrawn", color: "#6b7280" },
  { value: "closed", label: "Closed", color: "#6b7280" },
];

const PIPELINE_COLUMNS = [
  "pending",
  "submitted",
  "interview",
  "offer",
  "rejected",
];

export function renderApplications(props: ApplicationsProps) {
  return html`
    <section class="applications-view">
      <div class="card">
        <div
          class="row"
          style="justify-content: space-between; align-items: center;"
        >
          <div>
            <div class="card-title">Application Tracker</div>
            <div class="card-sub">
              ${props.applications.length} applications
            </div>
          </div>
          <div class="row" style="gap: 8px;">
            <div class="view-toggle">
              <button
                class="btn ${props.viewMode === "pipeline" ? "active" : ""}"
                @click=${() => props.onViewModeChange("pipeline")}
              >
                Pipeline
              </button>
              <button
                class="btn ${props.viewMode === "list" ? "active" : ""}"
                @click=${() => props.onViewModeChange("list")}
              >
                List
              </button>
            </div>
            <button
              class="btn"
              ?disabled=${props.loading}
              @click=${props.onRefresh}
            >
              ${props.loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        ${props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${props.error}
            </div>`
          : nothing}

        <div class="applications-content" style="margin-top: 16px;">
          ${props.viewMode === "pipeline"
            ? renderPipelineView(props)
            : renderListView(props)}
        </div>
      </div>

      ${props.selectedApplication ? renderApplicationModal(props) : nothing}
    </section>
  `;
}

function renderPipelineView(props: ApplicationsProps) {
  const columns = PIPELINE_COLUMNS.map((status) => ({
    status,
    label:
      APPLICATION_STATUSES.find((s) => s.value === status)?.label ?? status,
    applications: props.applications.filter((app) => app.status === status),
  }));

  return html`
    <div class="pipeline-container">
      ${columns.map(
        (col) => html`
          <div class="pipeline-column">
            <div class="pipeline-header">
              <span class="pipeline-title">${col.label}</span>
              <span class="pipeline-count">${col.applications.length}</span>
            </div>
            <div class="pipeline-cards">
              ${col.applications.length === 0
                ? html`<div class="pipeline-empty">No applications</div>`
                : col.applications.map((app) => renderPipelineCard(app, props))}
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

function renderPipelineCard(app: Application, props: ApplicationsProps) {
  return html`
    <div class="pipeline-card" @click=${() => props.onSelectApplication(app)}>
      <div class="pipeline-card-title">
        ${app.job?.title ?? "Unknown Position"}
      </div>
      <div class="pipeline-card-company">
        ${app.job?.company ?? "Unknown Company"}
      </div>
      <div class="pipeline-card-meta">
        ${app.appliedAt ? formatAgo(app.appliedAt) : "Not submitted"}
      </div>
    </div>
  `;
}

function renderListView(props: ApplicationsProps) {
  if (props.applications.length === 0) {
    return html`
      <div class="muted" style="padding: 20px; text-align: center;">
        No applications yet. Start by approving jobs from the Jobs tab.
      </div>
    `;
  }

  return html`
    <div class="table">
      <div class="table-head">
        <div>Position</div>
        <div>Company</div>
        <div>Status</div>
        <div>Applied</div>
        <div>Last Activity</div>
        <div>Actions</div>
      </div>
      ${props.applications.map((app) => renderApplicationRow(app, props))}
    </div>
  `;
}

function renderApplicationRow(app: Application, props: ApplicationsProps) {
  const statusInfo = APPLICATION_STATUSES.find((s) => s.value === app.status);

  return html`
    <div class="table-row">
      <div>${app.job?.title ?? "Unknown"}</div>
      <div>${app.job?.company ?? "Unknown"}</div>
      <div>
        <span
          class="status-badge"
          style="background-color: ${statusInfo?.color ?? "#6b7280"}"
        >
          ${statusInfo?.label ?? app.status}
        </span>
      </div>
      <div>${app.appliedAt ? formatAgo(app.appliedAt) : "—"}</div>
      <div>${formatAgo(app.lastActivityAt)}</div>
      <div>
        <button
          class="btn small"
          @click=${() => props.onSelectApplication(app)}
        >
          View
        </button>
      </div>
    </div>
  `;
}

function renderApplicationModal(props: ApplicationsProps) {
  const app = props.selectedApplication!;
  const statusInfo = APPLICATION_STATUSES.find((s) => s.value === app.status);

  return html`
    <div class="modal-overlay" @click=${() => props.onSelectApplication(null)}>
      <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Application Details</h2>
          <button
            class="btn-close"
            @click=${() => props.onSelectApplication(null)}
          >
            ×
          </button>
        </div>

        <div class="modal-body">
          <div class="detail-section">
            <h3>${app.job?.title ?? "Unknown Position"}</h3>
            <p class="company-name">${app.job?.company ?? "Unknown Company"}</p>
            ${app.job?.location
              ? html`<p class="location">${app.job.location}</p>`
              : nothing}
          </div>

          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">Status</span>
              <span
                class="status-badge"
                style="background-color: ${statusInfo?.color ?? "#6b7280"}"
              >
                ${statusInfo?.label ?? app.status}
              </span>
            </div>
            <div class="detail-item">
              <span class="label">Applied</span>
              <span
                >${app.appliedAt
                  ? new Date(app.appliedAt).toLocaleDateString()
                  : "Not yet"}</span
              >
            </div>
            <div class="detail-item">
              <span class="label">Last Activity</span>
              <span>${formatAgo(app.lastActivityAt)}</span>
            </div>
            <div class="detail-item">
              <span class="label">Created</span>
              <span>${new Date(app.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          ${app.coverLetter
            ? html`
                <div class="detail-section">
                  <h4>Cover Letter</h4>
                  <pre class="cover-letter">${app.coverLetter}</pre>
                </div>
              `
            : nothing}
          ${props.emailThreads.length > 0
            ? html`
                <div class="detail-section">
                  <h4>Email Threads</h4>
                  <div class="email-threads">
                    ${props.emailThreads.map(
                      (thread) => html`
                        <div class="email-thread">
                          <div class="thread-subject">${thread.subject}</div>
                          <div class="thread-meta">
                            <span>${thread.fromEmail}</span>
                            <span>${thread.messageCount} messages</span>
                            <span>${formatAgo(thread.lastMessageAt)}</span>
                          </div>
                        </div>
                      `,
                    )}
                  </div>
                </div>
              `
            : nothing}
          ${app.notes
            ? html`
                <div class="detail-section">
                  <h4>Notes</h4>
                  <p>${app.notes}</p>
                </div>
              `
            : nothing}

          <div class="detail-section">
            <h4>Update Status</h4>
            <div class="status-actions">
              ${APPLICATION_STATUSES.filter(
                (s) => s.value !== app.status && s.value !== "closed",
              ).map(
                (s) => html`
                  <button
                    class="btn small"
                    style="border-color: ${s.color}; color: ${s.color};"
                    @click=${() => props.onUpdateStatus(app.id, s.value)}
                  >
                    ${s.label}
                  </button>
                `,
              )}
            </div>
          </div>
        </div>

        <div class="modal-footer">
          ${app.job?.url
            ? html`<a href=${app.job.url} target="_blank" class="btn"
                >View Job</a
              >`
            : nothing}
          <button class="btn" @click=${() => props.onSelectApplication(null)}>
            Close
          </button>
        </div>
      </div>
    </div>
  `;
}
